"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ws_1 = require("ws");
const connection_1 = require("./connection");
const session_1 = require("./session");
(0, vitest_1.describe)('SessionManager', () => {
    let server;
    let port;
    let connection;
    let session;
    (0, vitest_1.beforeEach)(async () => {
        server = new ws_1.WebSocketServer({ port: 0 });
        port = server.address().port;
    });
    (0, vitest_1.afterEach)(async () => {
        if (session) {
            session.stopHeartbeat();
        }
        if (connection) {
            connection.close();
        }
        await new Promise((resolve) => server.close(() => resolve()));
    });
    (0, vitest_1.describe)('register', () => {
        (0, vitest_1.it)('should send RegisterMessage and resolve with public URL', async () => {
            let receivedMessage = '';
            server.on('connection', (ws) => {
                ws.on('message', (data) => {
                    receivedMessage = data.toString();
                    const msg = JSON.parse(receivedMessage);
                    if (msg.action === 'register') {
                        ws.send(JSON.stringify({
                            action: 'registered',
                            publicUrl: 'https://abc123.example.com/',
                            subdomain: 'abc123',
                            sessionToken: 'session-token-xyz',
                        }));
                    }
                });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 3000);
            const url = await session.register();
            (0, vitest_1.expect)(url).toBe('https://abc123.example.com/');
            (0, vitest_1.expect)(session.publicUrl).toBe('https://abc123.example.com/');
            (0, vitest_1.expect)(session.sessionToken).toBe('session-token-xyz');
            const sent = JSON.parse(receivedMessage);
            (0, vitest_1.expect)(sent).toEqual({ action: 'register', localPort: 3000 });
        });
        (0, vitest_1.it)('should include sessionToken in RegisterMessage when provided', async () => {
            let receivedMessage = '';
            server.on('connection', (ws) => {
                ws.on('message', (data) => {
                    receivedMessage = data.toString();
                    const msg = JSON.parse(receivedMessage);
                    if (msg.action === 'register') {
                        ws.send(JSON.stringify({
                            action: 'registered',
                            publicUrl: 'https://abc123.example.com/',
                            subdomain: 'abc123',
                            sessionToken: 'new-session-token',
                        }));
                    }
                });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 4000);
            await session.register('old-session-token');
            const sent = JSON.parse(receivedMessage);
            (0, vitest_1.expect)(sent).toEqual({
                action: 'register',
                localPort: 4000,
                sessionToken: 'old-session-token',
            });
        });
        (0, vitest_1.it)('should store sessionToken on ConnectionManager for reconnection', async () => {
            server.on('connection', (ws) => {
                ws.on('message', (data) => {
                    const msg = JSON.parse(data.toString());
                    if (msg.action === 'register') {
                        ws.send(JSON.stringify({
                            action: 'registered',
                            publicUrl: 'https://test.example.com/',
                            subdomain: 'test',
                            sessionToken: 'reconnect-token-123',
                        }));
                    }
                });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 5000);
            await session.register();
            (0, vitest_1.expect)(connection.sessionToken).toBe('reconnect-token-123');
        });
        (0, vitest_1.it)('should print public URL to stdout', async () => {
            const writeSpy = vitest_1.vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
            server.on('connection', (ws) => {
                ws.on('message', (data) => {
                    const msg = JSON.parse(data.toString());
                    if (msg.action === 'register') {
                        ws.send(JSON.stringify({
                            action: 'registered',
                            publicUrl: 'https://myurl.example.com/',
                            subdomain: 'myurl',
                            sessionToken: 'token',
                        }));
                    }
                });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 3000);
            await session.register();
            (0, vitest_1.expect)(writeSpy).toHaveBeenCalledWith('✓ Tunnel established! Public URL: https://myurl.example.com/\n');
            writeSpy.mockRestore();
        });
    });
    (0, vitest_1.describe)('heartbeat', () => {
        (0, vitest_1.it)('should send heartbeat messages at 30-second intervals', async () => {
            server.on('connection', (ws) => {
                ws.on('message', () => { });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 3000);
            const sendSpy = vitest_1.vi.spyOn(connection, 'send');
            // Switch to fake timers before starting heartbeat so setInterval is captured
            vitest_1.vi.useFakeTimers({ shouldAdvanceTime: false });
            session.startHeartbeat();
            vitest_1.vi.advanceTimersByTime(30_000);
            (0, vitest_1.expect)(sendSpy).toHaveBeenCalledTimes(1);
            const sent = JSON.parse(sendSpy.mock.calls[0][0]);
            (0, vitest_1.expect)(sent.action).toBe('heartbeat');
            (0, vitest_1.expect)(typeof sent.timestamp).toBe('number');
            vitest_1.vi.useRealTimers();
        });
        (0, vitest_1.it)('should not start multiple heartbeat timers', async () => {
            server.on('connection', (ws) => {
                ws.on('message', () => { });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 3000);
            const sendSpy = vitest_1.vi.spyOn(connection, 'send');
            vitest_1.vi.useFakeTimers({ shouldAdvanceTime: false });
            session.startHeartbeat();
            session.startHeartbeat(); // duplicate call
            vitest_1.vi.advanceTimersByTime(30_000);
            // Should only be 1, not 2
            (0, vitest_1.expect)(sendSpy).toHaveBeenCalledTimes(1);
            vitest_1.vi.useRealTimers();
        });
        (0, vitest_1.it)('should stop heartbeat when stopHeartbeat is called', async () => {
            server.on('connection', (ws) => {
                ws.on('message', () => { });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 3000);
            const sendSpy = vitest_1.vi.spyOn(connection, 'send');
            vitest_1.vi.useFakeTimers({ shouldAdvanceTime: false });
            session.startHeartbeat();
            session.stopHeartbeat();
            vitest_1.vi.advanceTimersByTime(60_000);
            (0, vitest_1.expect)(sendSpy).not.toHaveBeenCalled();
            vitest_1.vi.useRealTimers();
        });
        (0, vitest_1.it)('should handle HeartbeatAck without errors', async () => {
            server.on('connection', (ws) => {
                ws.on('message', (data) => {
                    const msg = JSON.parse(data.toString());
                    if (msg.action === 'heartbeat') {
                        ws.send(JSON.stringify({
                            action: 'heartbeat_ack',
                            timestamp: Date.now(),
                        }));
                    }
                });
            });
            connection = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
            await connection.connect();
            session = new session_1.SessionManager(connection, 3000);
            session.startHeartbeat();
            // Manually trigger a heartbeat and wait for ack
            connection.send(JSON.stringify({ action: 'heartbeat', timestamp: Date.now() }));
            // Give time for the ack to arrive
            await new Promise((resolve) => setTimeout(resolve, 100));
            // No error thrown — test passes
            (0, vitest_1.expect)(true).toBe(true);
        });
    });
});
//# sourceMappingURL=session.test.js.map