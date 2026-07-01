"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const helpers_1 = require("./helpers");
const connection_1 = require("../../cli/connection");
const session_1 = require("../../cli/session");
(0, vitest_1.describe)('Integration: Tunnel Flow', () => {
    let testSession = null;
    (0, vitest_1.afterEach)(async () => {
        if (testSession) {
            await (0, helpers_1.teardownTestSession)(testSession);
            testSession = null;
        }
    });
    (0, vitest_1.it)('should establish a tunnel, register a session, and return a public URL', async () => {
        testSession = await (0, helpers_1.createTestSession)(4000);
        // Verify the session manager received a public URL
        (0, vitest_1.expect)(testSession.session.publicUrl).toBeTruthy();
        (0, vitest_1.expect)(testSession.session.publicUrl).toContain('localhost');
        // Verify session token was assigned
        (0, vitest_1.expect)(testSession.session.sessionToken).toBeTruthy();
        // Verify the mock gateway tracked the session
        (0, vitest_1.expect)(testSession.gateway.sessions.size).toBe(1);
        const [session] = [...testSession.gateway.sessions.values()];
        (0, vitest_1.expect)(session.subdomain).toBeTruthy();
        (0, vitest_1.expect)(session.localPort).toBe(4000);
        (0, vitest_1.expect)(session.sessionToken).toBeTruthy();
    });
    (0, vitest_1.it)('should handle heartbeat exchange', async () => {
        testSession = await (0, helpers_1.createTestSession)(3000);
        // Start heartbeat
        testSession.session.startHeartbeat();
        // Wait for at least one heartbeat to be sent and acknowledged by the gateway
        const gateway = testSession.gateway;
        await (0, helpers_1.waitForCondition)(() => {
            const sessions = [...gateway.sessions.values()];
            return sessions.length > 0 && sessions[0].lastHeartbeat !== null;
        }, 35000); // Heartbeat interval is 30s, give extra buffer
        const [session] = [...gateway.sessions.values()];
        (0, vitest_1.expect)(session.lastHeartbeat).toBeGreaterThan(0);
    }, 40000);
    (0, vitest_1.it)('should track multiple concurrent sessions', async () => {
        const gateway = new helpers_1.MockGateway();
        await gateway.start();
        const sessions = [];
        try {
            // Create 3 concurrent sessions
            for (let i = 0; i < 3; i++) {
                const connection = new connection_1.ConnectionManager(gateway.url, `test-token-${i}`);
                await connection.connect();
                const sessionMgr = new session_1.SessionManager(connection, 3000 + i);
                await sessionMgr.register();
                sessions.push({ connection, session: sessionMgr });
            }
            // Verify all sessions are tracked
            (0, vitest_1.expect)(gateway.sessions.size).toBe(3);
            // Verify each session has a unique subdomain
            const subdomains = [...gateway.sessions.values()].map((s) => s.subdomain);
            const uniqueSubdomains = new Set(subdomains);
            (0, vitest_1.expect)(uniqueSubdomains.size).toBe(3);
        }
        finally {
            // Clean up
            for (const { connection, session } of sessions) {
                session.stopHeartbeat();
                connection.close();
            }
            await gateway.stop();
        }
    });
    (0, vitest_1.it)('should handle disconnection gracefully', async () => {
        testSession = await (0, helpers_1.createTestSession)(3000);
        // Verify connection is active
        (0, vitest_1.expect)(testSession.connection.state).toBe('connected');
        (0, vitest_1.expect)(testSession.gateway.sessions.size).toBe(1);
        // Close the connection
        testSession.connection.close();
        // Wait for the gateway to detect disconnection
        await (0, helpers_1.waitForCondition)(() => testSession.gateway.sessions.size === 0);
        (0, vitest_1.expect)(testSession.gateway.sessions.size).toBe(0);
        (0, vitest_1.expect)(testSession.connection.state).toBe('disconnected');
        // Prevent teardown from double-closing
        await testSession.gateway.stop();
        testSession = null;
    });
    (0, vitest_1.it)('should receive mock request from gateway', async () => {
        testSession = await (0, helpers_1.createTestSession)(8080);
        const [gatewaySession] = [...testSession.gateway.sessions.values()];
        const connectionId = gatewaySession.connectionId;
        // Listen for messages on the client side
        const receivedMessages = [];
        testSession.connection.on('message', (data) => {
            receivedMessages.push(data);
        });
        // Send a mock tunnel request from the gateway
        testSession.gateway.sendRequest(connectionId, {
            requestId: 'req-123',
            method: 'GET',
            path: '/api/test',
            headers: { 'content-type': 'application/json' },
            body: null,
            isBase64Encoded: false,
            timestamp: Date.now(),
        });
        // Wait for the client to receive the message
        await (0, helpers_1.waitForCondition)(() => receivedMessages.length > 0);
        // Verify the message was received
        (0, vitest_1.expect)(receivedMessages.length).toBeGreaterThan(0);
        const parsed = JSON.parse(receivedMessages[receivedMessages.length - 1]);
        (0, vitest_1.expect)(parsed.type).toBe('request');
        (0, vitest_1.expect)(parsed.totalChunks).toBe(1);
        // Verify the payload contains the original request
        const payload = JSON.parse(parsed.payload);
        (0, vitest_1.expect)(payload.requestId).toBe('req-123');
        (0, vitest_1.expect)(payload.method).toBe('GET');
        (0, vitest_1.expect)(payload.path).toBe('/api/test');
    });
});
//# sourceMappingURL=tunnel-flow.test.js.map