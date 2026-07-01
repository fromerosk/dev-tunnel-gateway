"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockGateway = void 0;
exports.createTestSession = createTestSession;
exports.teardownTestSession = teardownTestSession;
exports.waitForCondition = waitForCondition;
const ws_1 = require("ws");
const events_1 = require("events");
const uuid_1 = require("uuid");
const connection_1 = require("../../cli/connection");
const session_1 = require("../../cli/session");
/**
 * A mock WebSocket gateway server for integration testing.
 *
 * Simulates the AWS WebSocket API Gateway behavior:
 * - Accepts connections on a random local port
 * - Responds to register messages with a RegisterResponse
 * - Responds to heartbeats with HeartbeatAck
 * - Can forward mock requests to connected clients
 * - Tracks connected sessions
 */
class MockGateway extends events_1.EventEmitter {
    wss = null;
    _port = 0;
    _sessions = new Map();
    /** The port the mock gateway is listening on. */
    get port() {
        return this._port;
    }
    /** The gateway URL clients should connect to. */
    get url() {
        return `ws://localhost:${this._port}`;
    }
    /** All currently tracked sessions. */
    get sessions() {
        return this._sessions;
    }
    /**
     * Starts the mock gateway on a random available port.
     */
    start() {
        return new Promise((resolve, reject) => {
            this.wss = new ws_1.WebSocketServer({ port: 0 }, () => {
                const address = this.wss.address();
                if (typeof address === 'object' && address !== null) {
                    this._port = address.port;
                }
                resolve();
            });
            this.wss.on('error', reject);
            this.wss.on('connection', (ws, req) => {
                const connectionId = (0, uuid_1.v4)();
                const session = {
                    connectionId,
                    ws,
                    subdomain: null,
                    localPort: null,
                    sessionToken: null,
                    lastHeartbeat: null,
                };
                this._sessions.set(connectionId, session);
                this.emit('connection', session);
                ws.on('message', (rawData) => {
                    const data = rawData.toString();
                    this.handleMessage(session, data);
                });
                ws.on('close', () => {
                    this._sessions.delete(connectionId);
                    this.emit('disconnection', session);
                });
                ws.on('error', () => {
                    this._sessions.delete(connectionId);
                });
            });
        });
    }
    /**
     * Stops the mock gateway and closes all connections.
     */
    stop() {
        return new Promise((resolve) => {
            if (!this.wss) {
                resolve();
                return;
            }
            // Close all client connections first
            for (const session of this._sessions.values()) {
                if (session.ws.readyState === ws_1.WebSocket.OPEN) {
                    session.ws.close();
                }
            }
            this._sessions.clear();
            this.wss.close(() => {
                this.wss = null;
                resolve();
            });
        });
    }
    /**
     * Sends a mock TunnelRequest to a specific session.
     */
    sendRequest(connectionId, request) {
        const session = this._sessions.get(connectionId);
        if (!session || session.ws.readyState !== ws_1.WebSocket.OPEN) {
            throw new Error(`Session ${connectionId} not found or not connected`);
        }
        const message = JSON.stringify({
            messageId: request.requestId,
            chunkIndex: 0,
            totalChunks: 1,
            payload: JSON.stringify(request),
            type: 'request',
        });
        session.ws.send(message);
    }
    /**
     * Sends a raw string message to a specific session.
     */
    sendRaw(connectionId, data) {
        const session = this._sessions.get(connectionId);
        if (!session || session.ws.readyState !== ws_1.WebSocket.OPEN) {
            throw new Error(`Session ${connectionId} not found or not connected`);
        }
        session.ws.send(data);
    }
    /**
     * Handles incoming messages from connected clients.
     */
    handleMessage(session, data) {
        try {
            const msg = JSON.parse(data);
            switch (msg.action) {
                case 'register':
                    this.handleRegister(session, msg);
                    break;
                case 'heartbeat':
                    this.handleHeartbeat(session, msg);
                    break;
                default:
                    // Emit for custom handling in tests
                    this.emit('message', { session, data: msg });
                    break;
            }
        }
        catch {
            // Non-JSON message, emit raw
            this.emit('rawMessage', { session, data });
        }
    }
    handleRegister(session, msg) {
        const subdomain = `test-${(0, uuid_1.v4)().slice(0, 8)}`;
        const sessionToken = (0, uuid_1.v4)();
        session.subdomain = subdomain;
        session.localPort = msg.localPort;
        session.sessionToken = sessionToken;
        const response = {
            action: 'registered',
            publicUrl: `http://${subdomain}.localhost:${this._port}`,
            subdomain,
            sessionToken,
        };
        session.ws.send(JSON.stringify(response));
        this.emit('registered', session);
    }
    handleHeartbeat(session, msg) {
        session.lastHeartbeat = msg.timestamp;
        const ack = {
            action: 'heartbeat_ack',
            timestamp: Date.now(),
        };
        session.ws.send(JSON.stringify(ack));
        this.emit('heartbeat', session);
    }
}
exports.MockGateway = MockGateway;
/**
 * Creates a test session with a MockGateway and a connected ConnectionManager + SessionManager.
 *
 * @param localPort - The local port to register (default: 3000)
 * @returns A TestSession object with gateway, connection manager, and session manager.
 */
async function createTestSession(localPort = 3000) {
    const gateway = new MockGateway();
    await gateway.start();
    const connection = new connection_1.ConnectionManager(gateway.url, 'test-token');
    await connection.connect();
    const sessionMgr = new session_1.SessionManager(connection, localPort);
    await sessionMgr.register();
    return { gateway, connection, session: sessionMgr };
}
/**
 * Tears down a test session by closing the connection and stopping the gateway.
 */
async function teardownTestSession(testSession) {
    testSession.session.stopHeartbeat();
    testSession.connection.close();
    await testSession.gateway.stop();
}
/**
 * Waits for a condition to become true, polling at a short interval.
 *
 * @param fn - A function that returns true when the condition is met.
 * @param timeout - Maximum wait time in ms (default: 5000).
 * @param interval - Polling interval in ms (default: 50).
 * @throws If the condition is not met within the timeout.
 */
async function waitForCondition(fn, timeout = 5000, interval = 50) {
    const start = Date.now();
    while (!fn()) {
        if (Date.now() - start > timeout) {
            throw new Error(`waitForCondition timed out after ${timeout}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}
//# sourceMappingURL=helpers.js.map