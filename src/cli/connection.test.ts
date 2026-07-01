import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { ConnectionManager, ConnectionState } from './connection';

describe('ConnectionManager', () => {
  let server: WebSocketServer;
  let port: number;
  let manager: ConnectionManager;

  beforeEach(async () => {
    // Start a local WebSocket server for testing
    server = new WebSocketServer({ port: 0 });
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    if (manager) {
      manager.close();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should start in disconnected state', () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    expect(manager.state).toBe('disconnected');
  });

  it('should connect to a WebSocket server and transition to connected state', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    await manager.connect();
    expect(manager.state).toBe('connected');
  });

  it('should append token as query parameter to gateway URL', async () => {
    let receivedUrl = '';
    server.on('connection', (_ws, req) => {
      receivedUrl = req.url ?? '';
    });

    manager = new ConnectionManager(`ws://localhost:${port}`, 'my-secret-token');
    await manager.connect();

    expect(receivedUrl).toBe('/?token=my-secret-token');
  });

  it('should handle URL that already has query parameters', async () => {
    let receivedUrl = '';
    server.on('connection', (_ws, req) => {
      receivedUrl = req.url ?? '';
    });

    manager = new ConnectionManager(`ws://localhost:${port}/?foo=bar`, 'my-token');
    await manager.connect();

    expect(receivedUrl).toBe('/?foo=bar&token=my-token');
  });

  it('should emit connected event on successful connection', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    const connectedHandler = vi.fn();
    manager.on('connected', connectedHandler);

    await manager.connect();

    expect(connectedHandler).toHaveBeenCalledOnce();
  });

  it('should emit message event when receiving data', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');

    server.on('connection', (ws) => {
      ws.send('hello from server');
    });

    const messagePromise = new Promise<string>((resolve) => {
      manager.on('message', resolve);
    });

    await manager.connect();
    const message = await messagePromise;

    expect(message).toBe('hello from server');
  });

  it('should send data through the WebSocket', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');

    const serverReceived = new Promise<string>((resolve) => {
      server.on('connection', (ws) => {
        ws.on('message', (data) => resolve(data.toString()));
      });
    });

    await manager.connect();
    manager.send('hello from client');

    const received = await serverReceived;
    expect(received).toBe('hello from client');
  });

  it('should throw when sending on a disconnected connection', () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    expect(() => manager.send('test')).toThrow('Cannot send: WebSocket is not connected');
  });

  it('should transition to disconnected state on close()', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    await manager.connect();

    const states: ConnectionState[] = [];
    manager.on('stateChange', (state: ConnectionState) => states.push(state));

    manager.close();

    expect(manager.state).toBe('disconnected');
  });

  it('should not attempt reconnection after intentional close', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    await manager.connect();

    const reconnectingHandler = vi.fn();
    manager.on('reconnecting', reconnectingHandler);

    manager.close();

    // Wait a bit to confirm no reconnection attempt
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(reconnectingHandler).not.toHaveBeenCalled();
  });

  it('should attempt reconnection on unexpected disconnect', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    await manager.connect();

    const reconnectingHandler = vi.fn();
    manager.on('reconnecting', reconnectingHandler);

    // Force close from server side
    server.clients.forEach((client) => client.close());

    // Wait for reconnection attempt (first retry delay is 1s)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(reconnectingHandler).toHaveBeenCalledWith(1);
    expect(manager.state).toMatch(/connecting|reconnecting|connected/);
  });

  it('should emit failed after max retries are exhausted', async () => {
    // Create a server that immediately closes connections to trigger retries
    const rejectServer = new WebSocketServer({ port: 0 });
    const rejectPort = (rejectServer.address() as { port: number }).port;

    // Close the server so all connection attempts are refused
    await new Promise<void>((resolve) => rejectServer.close(() => resolve()));

    manager = new ConnectionManager(`ws://localhost:${rejectPort}`, 'test-token');

    // Add error listener to suppress unhandled errors from EventEmitter
    manager.on('error', () => {
      // intentionally empty — suppress unhandled error events
    });

    const failedPromise = new Promise<string>((resolve) => {
      manager.on('failed', resolve);
    });

    const connectPromise = manager.connect().catch(() => {
      // Expected to reject
    });

    const reason = await failedPromise;
    expect(reason).toBe('Maximum reconnection attempts exceeded');
    expect(manager.state).toBe('disconnected');

    await connectPromise;
  }, 120_000);

  it('should have null sessionToken initially', () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    expect(manager.sessionToken).toBeNull();
  });

  it('should allow setting sessionToken for reconnection', async () => {
    manager = new ConnectionManager(`ws://localhost:${port}`, 'test-token');
    await manager.connect();

    manager.sessionToken = 'session-abc-123';
    expect(manager.sessionToken).toBe('session-abc-123');
  });
});
