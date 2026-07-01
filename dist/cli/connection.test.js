"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ws_1 = require("ws");
const connection_1 = require("./connection");
(0, vitest_1.describe)('ConnectionManager', () => {
    let server;
    let port;
    let manager;
    (0, vitest_1.beforeEach)(async () => {
        // Start a local WebSocket server for testing
        server = new ws_1.WebSocketServer({ port: 0 });
        port = server.address().port;
    });
    (0, vitest_1.afterEach)(async () => {
        if (manager) {
            manager.close();
        }
        await new Promise((resolve) => server.close(() => resolve()));
    });
    (0, vitest_1.it)('should start in disconnected state', () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        (0, vitest_1.expect)(manager.state).toBe('disconnected');
    });
    (0, vitest_1.it)('should connect to a WebSocket server and transition to connected state', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        await manager.connect();
        (0, vitest_1.expect)(manager.state).toBe('connected');
    });
    (0, vitest_1.it)('should append token as query parameter to gateway URL', async () => {
        let receivedUrl = '';
        server.on('connection', (_ws, req) => {
            receivedUrl = req.url ?? '';
        });
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'my-secret-token');
        await manager.connect();
        (0, vitest_1.expect)(receivedUrl).toBe('/?token=my-secret-token');
    });
    (0, vitest_1.it)('should handle URL that already has query parameters', async () => {
        let receivedUrl = '';
        server.on('connection', (_ws, req) => {
            receivedUrl = req.url ?? '';
        });
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}/?foo=bar`, 'my-token');
        await manager.connect();
        (0, vitest_1.expect)(receivedUrl).toBe('/?foo=bar&token=my-token');
    });
    (0, vitest_1.it)('should emit connected event on successful connection', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        const connectedHandler = vitest_1.vi.fn();
        manager.on('connected', connectedHandler);
        await manager.connect();
        (0, vitest_1.expect)(connectedHandler).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('should emit message event when receiving data', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        server.on('connection', (ws) => {
            ws.send('hello from server');
        });
        const messagePromise = new Promise((resolve) => {
            manager.on('message', resolve);
        });
        await manager.connect();
        const message = await messagePromise;
        (0, vitest_1.expect)(message).toBe('hello from server');
    });
    (0, vitest_1.it)('should send data through the WebSocket', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        const serverReceived = new Promise((resolve) => {
            server.on('connection', (ws) => {
                ws.on('message', (data) => resolve(data.toString()));
            });
        });
        await manager.connect();
        manager.send('hello from client');
        const received = await serverReceived;
        (0, vitest_1.expect)(received).toBe('hello from client');
    });
    (0, vitest_1.it)('should throw when sending on a disconnected connection', () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        (0, vitest_1.expect)(() => manager.send('test')).toThrow('Cannot send: WebSocket is not connected');
    });
    (0, vitest_1.it)('should transition to disconnected state on close()', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        await manager.connect();
        const states = [];
        manager.on('stateChange', (state) => states.push(state));
        manager.close();
        (0, vitest_1.expect)(manager.state).toBe('disconnected');
    });
    (0, vitest_1.it)('should not attempt reconnection after intentional close', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        await manager.connect();
        const reconnectingHandler = vitest_1.vi.fn();
        manager.on('reconnecting', reconnectingHandler);
        manager.close();
        // Wait a bit to confirm no reconnection attempt
        await new Promise((resolve) => setTimeout(resolve, 100));
        (0, vitest_1.expect)(reconnectingHandler).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should attempt reconnection on unexpected disconnect', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        await manager.connect();
        const reconnectingHandler = vitest_1.vi.fn();
        manager.on('reconnecting', reconnectingHandler);
        // Force close from server side
        server.clients.forEach((client) => client.close());
        // Wait for reconnection attempt (first retry delay is 1s)
        await new Promise((resolve) => setTimeout(resolve, 1500));
        (0, vitest_1.expect)(reconnectingHandler).toHaveBeenCalledWith(1);
        (0, vitest_1.expect)(manager.state).toMatch(/connecting|reconnecting|connected/);
    });
    (0, vitest_1.it)('should emit failed after max retries are exhausted', async () => {
        // Create a server that immediately closes connections to trigger retries
        const rejectServer = new ws_1.WebSocketServer({ port: 0 });
        const rejectPort = rejectServer.address().port;
        // Close the server so all connection attempts are refused
        await new Promise((resolve) => rejectServer.close(() => resolve()));
        manager = new connection_1.ConnectionManager(`ws://localhost:${rejectPort}`, 'test-token');
        // Add error listener to suppress unhandled errors from EventEmitter
        manager.on('error', () => {
            // intentionally empty — suppress unhandled error events
        });
        const failedPromise = new Promise((resolve) => {
            manager.on('failed', resolve);
        });
        const connectPromise = manager.connect().catch(() => {
            // Expected to reject
        });
        const reason = await failedPromise;
        (0, vitest_1.expect)(reason).toBe('Maximum reconnection attempts exceeded');
        (0, vitest_1.expect)(manager.state).toBe('disconnected');
        await connectPromise;
    }, 120_000);
    (0, vitest_1.it)('should have null sessionToken initially', () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        (0, vitest_1.expect)(manager.sessionToken).toBeNull();
    });
    (0, vitest_1.it)('should allow setting sessionToken for reconnection', async () => {
        manager = new connection_1.ConnectionManager(`ws://localhost:${port}`, 'test-token');
        await manager.connect();
        manager.sessionToken = 'session-abc-123';
        (0, vitest_1.expect)(manager.sessionToken).toBe('session-abc-123');
    });
});
//# sourceMappingURL=connection.test.js.map