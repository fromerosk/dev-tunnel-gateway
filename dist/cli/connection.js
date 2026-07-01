"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
const backoff_1 = require("../shared/backoff");
const constants_1 = require("../shared/constants");
/**
 * Manages the WebSocket connection to the dev tunnel gateway.
 *
 * Handles initial connection, exponential backoff reconnection,
 * and connection lifecycle events. Supports session token-based
 * reconnection within the 5-minute reconnection window.
 */
class ConnectionManager extends events_1.EventEmitter {
    gatewayUrl;
    authToken;
    ws = null;
    _state = 'disconnected';
    intentionalClose = false;
    reconnectAttempt = 0;
    disconnectedAt = null;
    reconnectTimer = null;
    /** Session token received after registration, used for reconnection. */
    sessionToken = null;
    constructor(gatewayUrl, authToken) {
        super();
        this.gatewayUrl = gatewayUrl;
        this.authToken = authToken;
    }
    /** Current connection state. */
    get state() {
        return this._state;
    }
    setState(newState) {
        this._state = newState;
        this.emit('stateChange', newState);
    }
    /**
     * Opens a WSS connection to the gateway with the auth token in the query string.
     * Resolves when the connection is established, or rejects if initial connection fails
     * after exhausting all retry attempts.
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.intentionalClose = false;
            this.reconnectAttempt = 0;
            this.attemptConnection(resolve, reject);
        });
    }
    attemptConnection(resolve, reject) {
        this.setState('connecting');
        const url = this.buildUrl();
        const ws = new ws_1.default(url);
        ws.onopen = () => {
            this.ws = ws;
            this.reconnectAttempt = 0;
            this.disconnectedAt = null;
            this.setState('connected');
            this.emit('connected');
            if (resolve) {
                resolve();
            }
        };
        ws.onclose = () => {
            if (this.intentionalClose) {
                this.setState('disconnected');
                this.emit('disconnected', 'intentional close');
                return;
            }
            // Track when disconnection happened
            if (this.disconnectedAt === null) {
                this.disconnectedAt = Date.now();
            }
            this.ws = null;
            this.reconnect(resolve, reject);
        };
        ws.onerror = (err) => {
            // The error event is typically followed by a close event,
            // so reconnection is handled in onclose. We emit for logging only
            // if there is a listener (Node's EventEmitter throws on unhandled 'error').
            if (this.listenerCount('error') > 0) {
                this.emit('error', err);
            }
        };
        ws.onmessage = (event) => {
            const data = typeof event.data === 'string' ? event.data : event.data.toString();
            this.emit('message', data);
        };
    }
    reconnect(resolve, reject) {
        // Check if within reconnection window (5 minutes)
        if (this.disconnectedAt !== null) {
            const elapsed = Date.now() - this.disconnectedAt;
            if (elapsed >= constants_1.RECONNECT_WINDOW_MS) {
                this.setState('disconnected');
                const reason = 'Reconnection window expired';
                this.emit('failed', reason);
                if (reject) {
                    reject(new Error(reason));
                }
                return;
            }
        }
        this.reconnectAttempt++;
        const delay = (0, backoff_1.getRetryDelay)(this.reconnectAttempt);
        if (delay === null) {
            // Exhausted all retry attempts
            this.setState('disconnected');
            const reason = 'Maximum reconnection attempts exceeded';
            this.emit('failed', reason);
            if (reject) {
                reject(new Error(reason));
            }
            return;
        }
        this.setState('reconnecting');
        this.emit('reconnecting', this.reconnectAttempt);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.attemptConnection(resolve, reject);
        }, delay);
    }
    buildUrl() {
        const separator = this.gatewayUrl.includes('?') ? '&' : '?';
        return `${this.gatewayUrl}${separator}token=${encodeURIComponent(this.authToken)}`;
    }
    /**
     * Sends data through the WebSocket connection.
     * Throws if the connection is not in a connected state.
     */
    send(data) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            throw new Error('Cannot send: WebSocket is not connected');
        }
        this.ws.send(data);
    }
    /**
     * Gracefully closes the WebSocket connection.
     * Sets the intentional close flag to prevent reconnection attempts.
     */
    close() {
        this.intentionalClose = true;
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setState('disconnected');
        this.emit('disconnected', 'intentional close');
    }
}
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=connection.js.map