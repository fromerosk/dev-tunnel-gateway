import { describe, it, expect, afterEach } from 'vitest';
import {
  MockGateway,
  createTestSession,
  teardownTestSession,
  waitForCondition,
  type TestSession,
} from './helpers';
import { ConnectionManager } from '../../cli/connection';
import { SessionManager } from '../../cli/session';

describe('Integration: Tunnel Flow', () => {
  let testSession: TestSession | null = null;

  afterEach(async () => {
    if (testSession) {
      await teardownTestSession(testSession);
      testSession = null;
    }
  });

  it('should establish a tunnel, register a session, and return a public URL', async () => {
    testSession = await createTestSession(4000);

    // Verify the session manager received a public URL
    expect(testSession.session.publicUrl).toBeTruthy();
    expect(testSession.session.publicUrl).toContain('localhost');

    // Verify session token was assigned
    expect(testSession.session.sessionToken).toBeTruthy();

    // Verify the mock gateway tracked the session
    expect(testSession.gateway.sessions.size).toBe(1);

    const [session] = [...testSession.gateway.sessions.values()];
    expect(session.subdomain).toBeTruthy();
    expect(session.localPort).toBe(4000);
    expect(session.sessionToken).toBeTruthy();
  });

  it('should handle heartbeat exchange', async () => {
    testSession = await createTestSession(3000);

    // Start heartbeat
    testSession.session.startHeartbeat();

    // Wait for at least one heartbeat to be sent and acknowledged by the gateway
    const gateway = testSession.gateway;
    await waitForCondition(() => {
      const sessions = [...gateway.sessions.values()];
      return sessions.length > 0 && sessions[0].lastHeartbeat !== null;
    }, 35000); // Heartbeat interval is 30s, give extra buffer

    const [session] = [...gateway.sessions.values()];
    expect(session.lastHeartbeat).toBeGreaterThan(0);
  }, 40000);

  it('should track multiple concurrent sessions', async () => {
    const gateway = new MockGateway();
    await gateway.start();

    const sessions: Array<{ connection: ConnectionManager; session: SessionManager }> = [];

    try {
      // Create 3 concurrent sessions
      for (let i = 0; i < 3; i++) {
        const connection = new ConnectionManager(gateway.url, `test-token-${i}`);
        await connection.connect();
        const sessionMgr = new SessionManager(connection, 3000 + i);
        await sessionMgr.register();
        sessions.push({ connection, session: sessionMgr });
      }

      // Verify all sessions are tracked
      expect(gateway.sessions.size).toBe(3);

      // Verify each session has a unique subdomain
      const subdomains = [...gateway.sessions.values()].map((s) => s.subdomain);
      const uniqueSubdomains = new Set(subdomains);
      expect(uniqueSubdomains.size).toBe(3);
    } finally {
      // Clean up
      for (const { connection, session } of sessions) {
        session.stopHeartbeat();
        connection.close();
      }
      await gateway.stop();
    }
  });

  it('should handle disconnection gracefully', async () => {
    testSession = await createTestSession(3000);

    // Verify connection is active
    expect(testSession.connection.state).toBe('connected');
    expect(testSession.gateway.sessions.size).toBe(1);

    // Close the connection
    testSession.connection.close();

    // Wait for the gateway to detect disconnection
    await waitForCondition(() => testSession!.gateway.sessions.size === 0);

    expect(testSession.gateway.sessions.size).toBe(0);
    expect(testSession.connection.state).toBe('disconnected');

    // Prevent teardown from double-closing
    await testSession.gateway.stop();
    testSession = null;
  });

  it('should receive mock request from gateway', async () => {
    testSession = await createTestSession(8080);

    const [gatewaySession] = [...testSession.gateway.sessions.values()];
    const connectionId = gatewaySession.connectionId;

    // Listen for messages on the client side
    const receivedMessages: string[] = [];
    testSession.connection.on('message', (data: string) => {
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
    await waitForCondition(() => receivedMessages.length > 0);

    // Verify the message was received
    expect(receivedMessages.length).toBeGreaterThan(0);
    const parsed = JSON.parse(receivedMessages[receivedMessages.length - 1]);
    expect(parsed.type).toBe('request');
    expect(parsed.totalChunks).toBe(1);

    // Verify the payload contains the original request
    const payload = JSON.parse(parsed.payload);
    expect(payload.requestId).toBe('req-123');
    expect(payload.method).toBe('GET');
    expect(payload.path).toBe('/api/test');
  });
});
