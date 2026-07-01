"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const constants_1 = require("../shared/constants");
/**
 * Manages tunnel session registration and heartbeat lifecycle.
 *
 * After the WebSocket connection is established, the SessionManager sends
 * a RegisterMessage and waits for a RegisterResponse containing the public URL
 * and session token. It then starts a periodic heartbeat to keep the session alive.
 */
class SessionManager {
    connection;
    localPort;
    heartbeatTimer = null;
    /** The public URL assigned by the gateway after registration. */
    publicUrl = null;
    /** The session token used for reconnection within the 5-minute window. */
    sessionToken = null;
    constructor(connection, localPort) {
        this.connection = connection;
        this.localPort = localPort;
    }
    /**
     * Sends a RegisterMessage and waits for the RegisterResponse.
     *
     * On success, stores the public URL and session token, sets the session token
     * on the ConnectionManager for reconnection, and prints the public URL to stdout.
     *
     * @param sessionToken - Optional session token for reconnection.
     * @returns The assigned public URL.
     */
    register(sessionToken) {
        return new Promise((resolve, reject) => {
            const registerMsg = {
                action: 'register',
                localPort: this.localPort,
            };
            if (sessionToken) {
                registerMsg.sessionToken = sessionToken;
            }
            const onMessage = (data) => {
                try {
                    const msg = JSON.parse(data);
                    if (msg.action === 'registered') {
                        this.connection.removeListener('message', onMessage);
                        const response = msg;
                        this.publicUrl = response.publicUrl;
                        this.sessionToken = response.sessionToken;
                        this.connection.sessionToken = response.sessionToken;
                        process.stdout.write(`✓ Tunnel established! Public URL: ${this.publicUrl}\n`);
                        resolve(this.publicUrl);
                    }
                }
                catch {
                    // Ignore non-JSON or unrelated messages
                }
            };
            this.connection.on('message', onMessage);
            try {
                this.connection.send(JSON.stringify(registerMsg));
            }
            catch (err) {
                this.connection.removeListener('message', onMessage);
                reject(err);
            }
        });
    }
    /**
     * Starts the heartbeat interval, sending a HeartbeatMessage every 30 seconds.
     * Also listens for HeartbeatAck responses (logged at debug level).
     */
    startHeartbeat() {
        if (this.heartbeatTimer !== null) {
            return;
        }
        this.heartbeatTimer = setInterval(() => {
            const heartbeat = {
                action: 'heartbeat',
                timestamp: Date.now(),
            };
            try {
                this.connection.send(JSON.stringify(heartbeat));
            }
            catch {
                // Connection may be temporarily unavailable during reconnection
            }
        }, constants_1.HEARTBEAT_INTERVAL_MS);
        // Listen for heartbeat acknowledgments
        this.connection.on('message', this.handleHeartbeatAck);
    }
    /**
     * Stops the heartbeat interval and removes the ack listener.
     */
    stopHeartbeat() {
        if (this.heartbeatTimer !== null) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this.connection.removeListener('message', this.handleHeartbeatAck);
    }
    /**
     * Handles incoming HeartbeatAck messages.
     * Logs at debug level — no further action needed.
     */
    handleHeartbeatAck = (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.action === 'heartbeat_ack') {
                // Debug-level acknowledgment — session is healthy
            }
        }
        catch {
            // Ignore non-JSON messages
        }
    };
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=session.js.map