import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionManager } from '../../cli/connection';
import { SessionManager } from '../../cli/session';
import type {
  RegisterMessage,
  RegisterResponse,
  HeartbeatMessage,
  HeartbeatAck,
  TunnelRequest,
} from '../../shared/types';

/**
 * Tracks a connected session on the mock gateway.
 */
export interface MockSession {
  connectionId: string;
  ws: WebSocket;
  subdomain: string | null;
  localPort: number | null;
  sessionToken: string | null;
  lastHeartbeat: number | null;
}

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
export class MockGateway extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private _port: number = 0;
  private _sessions: Map<string, MockSession> = new Map();

  /** The port the mock gateway is listening on. */
  get port(): number {
    return this._port;
  }

  /** The gateway URL clients should connect to. */
  get url(): string {
    return `ws://localhost:${this._port}`;
  }

  /** All currently tracked sessions. */
  get sessions(): Map<string, MockSession> {
    return this._sessions;
  }

  /**
   * Starts the mock gateway on a random available port.
   */
  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.wss = new WebSocketServer({ port: 0 }, () => {
        const address = this.wss!.address();
        if (typeof address === 'object' && address !== null) {
          this._port = address.port;
        }
        resolve();
      });

      this.wss.on('error', reject);

      this.wss.on('connection', (ws, req) => {
        const connectionId = uuidv4();
        const session: MockSession = {
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
  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all client connections first
      for (const session of this._sessions.values()) {
        if (session.ws.readyState === WebSocket.OPEN) {
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
  sendRequest(connectionId: string, request: TunnelRequest): void {
    const session = this._sessions.get(connectionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) {
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
  sendRaw(connectionId: string, data: string): void {
    const session = this._sessions.get(connectionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Session ${connectionId} not found or not connected`);
    }
    session.ws.send(data);
  }

  /**
   * Handles incoming messages from connected clients.
   */
  private handleMessage(session: MockSession, data: string): void {
    try {
      const msg = JSON.parse(data) as Record<string, unknown>;

      switch (msg.action) {
        case 'register':
          this.handleRegister(session, msg as unknown as RegisterMessage);
          break;
        case 'heartbeat':
          this.handleHeartbeat(session, msg as unknown as HeartbeatMessage);
          break;
        default:
          // Emit for custom handling in tests
          this.emit('message', { session, data: msg });
          break;
      }
    } catch {
      // Non-JSON message, emit raw
      this.emit('rawMessage', { session, data });
    }
  }

  private handleRegister(session: MockSession, msg: RegisterMessage): void {
    const subdomain = `test-${uuidv4().slice(0, 8)}`;
    const sessionToken = uuidv4();

    session.subdomain = subdomain;
    session.localPort = msg.localPort;
    session.sessionToken = sessionToken;

    const response: RegisterResponse = {
      action: 'registered',
      publicUrl: `http://${subdomain}.localhost:${this._port}`,
      subdomain,
      sessionToken,
    };

    session.ws.send(JSON.stringify(response));
    this.emit('registered', session);
  }

  private handleHeartbeat(session: MockSession, msg: HeartbeatMessage): void {
    session.lastHeartbeat = msg.timestamp;

    const ack: HeartbeatAck = {
      action: 'heartbeat_ack',
      timestamp: Date.now(),
    };

    session.ws.send(JSON.stringify(ack));
    this.emit('heartbeat', session);
  }
}

/**
 * A test session containing the mock gateway and a connected client.
 */
export interface TestSession {
  gateway: MockGateway;
  connection: ConnectionManager;
  session: SessionManager;
}

/**
 * Creates a test session with a MockGateway and a connected ConnectionManager + SessionManager.
 *
 * @param localPort - The local port to register (default: 3000)
 * @returns A TestSession object with gateway, connection manager, and session manager.
 */
export async function createTestSession(localPort: number = 3000): Promise<TestSession> {
  const gateway = new MockGateway();
  await gateway.start();

  const connection = new ConnectionManager(gateway.url, 'test-token');
  await connection.connect();

  const sessionMgr = new SessionManager(connection, localPort);
  await sessionMgr.register();

  return { gateway, connection, session: sessionMgr };
}

/**
 * Tears down a test session by closing the connection and stopping the gateway.
 */
export async function teardownTestSession(testSession: TestSession): Promise<void> {
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
export async function waitForCondition(
  fn: () => boolean,
  timeout: number = 5000,
  interval: number = 50,
): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitForCondition timed out after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
