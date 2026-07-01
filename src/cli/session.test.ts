import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { ConnectionManager } from './connection';
import { SessionManager } from './session';

describe('SessionManager', () => {
  let server: WebSocketServer;
  let port: number;
  let connection: ConnectionManager;
  let session: SessionManager;

  beforeEach(async () => {
    server = new WebSocketServer({ port: 0 });
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    if (session) {
      session.stopHeartbeat();
    }
    if (connection) {
      connection.close();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('register', () => {
    it('should send RegisterMessage and resolve with public URL', async () => {
      let receivedMessage = '';
      server.on('connection', (ws: WsWebSocket) => {
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

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 3000);
      const url = await session.register();

      expect(url).toBe('https://abc123.example.com/');
      expect(session.publicUrl).toBe('https://abc123.example.com/');
      expect(session.sessionToken).toBe('session-token-xyz');

      const sent = JSON.parse(receivedMessage);
      expect(sent).toEqual({ action: 'register', localPort: 3000 });
    });

    it('should include sessionToken in RegisterMessage when provided', async () => {
      let receivedMessage = '';
      server.on('connection', (ws: WsWebSocket) => {
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

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 4000);
      await session.register('old-session-token');

      const sent = JSON.parse(receivedMessage);
      expect(sent).toEqual({
        action: 'register',
        localPort: 4000,
        sessionToken: 'old-session-token',
      });
    });

    it('should store sessionToken on ConnectionManager for reconnection', async () => {
      server.on('connection', (ws: WsWebSocket) => {
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

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 5000);
      await session.register();

      expect(connection.sessionToken).toBe('reconnect-token-123');
    });

    it('should print public URL to stdout', async () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      server.on('connection', (ws: WsWebSocket) => {
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

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 3000);
      await session.register();

      expect(writeSpy).toHaveBeenCalledWith(
        '✓ Tunnel established! Public URL: https://myurl.example.com/\n',
      );

      writeSpy.mockRestore();
    });
  });

  describe('heartbeat', () => {
    it('should send heartbeat messages at 30-second intervals', async () => {
      server.on('connection', (ws: WsWebSocket) => {
        ws.on('message', () => {});
      });

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 3000);

      const sendSpy = vi.spyOn(connection, 'send');

      // Switch to fake timers before starting heartbeat so setInterval is captured
      vi.useFakeTimers({ shouldAdvanceTime: false });
      session.startHeartbeat();
      vi.advanceTimersByTime(30_000);

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(sendSpy.mock.calls[0][0] as string);
      expect(sent.action).toBe('heartbeat');
      expect(typeof sent.timestamp).toBe('number');

      vi.useRealTimers();
    });

    it('should not start multiple heartbeat timers', async () => {
      server.on('connection', (ws: WsWebSocket) => {
        ws.on('message', () => {});
      });

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 3000);

      const sendSpy = vi.spyOn(connection, 'send');

      vi.useFakeTimers({ shouldAdvanceTime: false });
      session.startHeartbeat();
      session.startHeartbeat(); // duplicate call
      vi.advanceTimersByTime(30_000);

      // Should only be 1, not 2
      expect(sendSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should stop heartbeat when stopHeartbeat is called', async () => {
      server.on('connection', (ws: WsWebSocket) => {
        ws.on('message', () => {});
      });

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 3000);

      const sendSpy = vi.spyOn(connection, 'send');

      vi.useFakeTimers({ shouldAdvanceTime: false });
      session.startHeartbeat();
      session.stopHeartbeat();
      vi.advanceTimersByTime(60_000);

      expect(sendSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle HeartbeatAck without errors', async () => {
      server.on('connection', (ws: WsWebSocket) => {
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

      connection = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
      await connection.connect();

      session = new SessionManager(connection, 3000);
      session.startHeartbeat();

      // Manually trigger a heartbeat and wait for ack
      connection.send(JSON.stringify({ action: 'heartbeat', timestamp: Date.now() }));

      // Give time for the ack to arrive
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No error thrown — test passes
      expect(true).toBe(true);
    });
  });
});
