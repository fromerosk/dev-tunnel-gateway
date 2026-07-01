"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestForwarder = void 0;
const http = __importStar(require("http"));
const chunker_1 = require("../shared/chunker");
const serializer_1 = require("../shared/serializer");
const errors_1 = require("../shared/errors");
const logger_1 = require("../shared/logger");
/**
 * Forwards incoming tunnel requests to the local development server
 * and relays responses back through the WebSocket connection.
 *
 * Handles chunked message reassembly, local HTTP proxying, error handling
 * for unreachable servers, and response chunking for large payloads.
 */
class RequestForwarder {
    connection;
    localPort;
    chunkBuffer = new chunker_1.ChunkBuffer();
    messageHandler = null;
    _inFlightCount = 0;
    /** Number of requests currently being proxied to the local server. */
    get inFlightCount() {
        return this._inFlightCount;
    }
    constructor(connection, localPort) {
        this.connection = connection;
        this.localPort = localPort;
    }
    /**
     * Starts listening for incoming request messages on the WebSocket connection.
     * Registers a message handler that processes chunked tunnel requests.
     */
    start() {
        this.messageHandler = (data) => {
            this.handleMessage(data);
        };
        this.connection.on('message', this.messageHandler);
    }
    /**
     * Stops listening for incoming request messages.
     * Removes the message handler from the connection.
     */
    stop() {
        if (this.messageHandler) {
            this.connection.off('message', this.messageHandler);
            this.messageHandler = null;
        }
    }
    handleMessage(data) {
        let parsed;
        try {
            parsed = JSON.parse(data);
        }
        catch {
            // Not a JSON message we care about, ignore
            return;
        }
        // Check if it's a ChunkedMessage with type 'request'
        if (!this.isChunkedRequest(parsed)) {
            return;
        }
        const chunk = parsed;
        const completed = this.chunkBuffer.addChunk(chunk);
        if (completed !== null) {
            // Reassembled full payload — parse as TunnelRequest and proxy
            let tunnelRequest;
            try {
                tunnelRequest = JSON.parse(completed);
            }
            catch {
                // Malformed request payload, ignore
                return;
            }
            this.proxyToLocal(tunnelRequest);
        }
    }
    isChunkedRequest(msg) {
        if (typeof msg !== 'object' || msg === null) {
            return false;
        }
        const obj = msg;
        return (typeof obj.messageId === 'string' &&
            typeof obj.chunkIndex === 'number' &&
            typeof obj.totalChunks === 'number' &&
            typeof obj.payload === 'string' &&
            obj.type === 'request');
    }
    proxyToLocal(tunnelRequest) {
        this._inFlightCount++;
        const startTime = Date.now();
        const { method, path, headers, body } = (0, serializer_1.deserializeRequest)(tunnelRequest);
        const options = {
            hostname: 'localhost',
            port: this.localPort,
            path,
            method,
            headers,
        };
        const req = http.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            res.on('end', () => {
                const responseBody = Buffer.concat(chunks);
                const statusCode = res.statusCode ?? 200;
                const responseHeaders = {};
                // Flatten response headers to single string values
                for (const [key, value] of Object.entries(res.headers)) {
                    if (typeof value === 'string') {
                        responseHeaders[key] = value;
                    }
                    else if (Array.isArray(value)) {
                        responseHeaders[key] = value.join(', ');
                    }
                }
                const tunnelResponse = (0, serializer_1.serializeResponse)(statusCode, responseHeaders, responseBody, tunnelRequest.requestId, startTime);
                this.sendResponse(tunnelResponse);
                const latencyMs = Date.now() - startTime;
                const logLine = (0, logger_1.formatRequestLog)(method, path, statusCode, latencyMs);
                console.log(logLine);
                this._inFlightCount--;
            });
        });
        req.on('error', (err) => {
            const latencyMs = Date.now() - startTime;
            if (err.code === 'ECONNREFUSED') {
                // Local server is unreachable
                const errorBody = (0, errors_1.createErrorResponse)(errors_1.ErrorCode.LOCAL_UNREACHABLE);
                const tunnelResponse = (0, serializer_1.serializeResponse)(502, { 'content-type': 'application/json' }, JSON.stringify(errorBody), tunnelRequest.requestId, startTime);
                this.sendResponse(tunnelResponse);
                const logLine = (0, logger_1.formatRequestLog)(method, path, 502, latencyMs);
                console.log(logLine);
                console.error(`[error] Local server not reachable on port ${this.localPort}`);
            }
            else {
                // Other network error — still send 502
                const errorBody = (0, errors_1.createErrorResponse)(errors_1.ErrorCode.LOCAL_UNREACHABLE);
                const tunnelResponse = (0, serializer_1.serializeResponse)(502, { 'content-type': 'application/json' }, JSON.stringify(errorBody), tunnelRequest.requestId, startTime);
                this.sendResponse(tunnelResponse);
                const logLine = (0, logger_1.formatRequestLog)(method, path, 502, latencyMs);
                console.log(logLine);
                console.error(`[error] Failed to proxy request: ${err.message}`);
            }
            this._inFlightCount--;
        });
        // Write body if present
        if (body !== null) {
            req.write(body);
        }
        req.end();
    }
    sendResponse(tunnelResponse) {
        const payload = JSON.stringify(tunnelResponse);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'response');
        for (const chunk of chunks) {
            try {
                this.connection.send(JSON.stringify(chunk));
            }
            catch {
                // Connection may be closed — log but don't crash
                console.error('[error] Failed to send response chunk through WebSocket');
                break;
            }
        }
    }
}
exports.RequestForwarder = RequestForwarder;
//# sourceMappingURL=forwarder.js.map