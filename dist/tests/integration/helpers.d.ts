import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../../cli/connection';
import { SessionManager } from '../../cli/session';
import type { TunnelRequest } from '../../shared/types';
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
export declare class MockGateway extends EventEmitter {
    private wss;
    private _port;
    private _sessions;
    /** The port the mock gateway is listening on. */
    get port(): number;
    /** The gateway URL clients should connect to. */
    get url(): string;
    /** All currently tracked sessions. */
    get sessions(): Map<string, MockSession>;
    /**
     * Starts the mock gateway on a random available port.
     */
    start(): Promise<void>;
    /**
     * Stops the mock gateway and closes all connections.
     */
    stop(): Promise<void>;
    /**
     * Sends a mock TunnelRequest to a specific session.
     */
    sendRequest(connectionId: string, request: TunnelRequest): void;
    /**
     * Sends a raw string message to a specific session.
     */
    sendRaw(connectionId: string, data: string): void;
    /**
     * Handles incoming messages from connected clients.
     */
    private handleMessage;
    private handleRegister;
    private handleHeartbeat;
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
export declare function createTestSession(localPort?: number): Promise<TestSession>;
/**
 * Tears down a test session by closing the connection and stopping the gateway.
 */
export declare function teardownTestSession(testSession: TestSession): Promise<void>;
/**
 * Waits for a condition to become true, polling at a short interval.
 *
 * @param fn - A function that returns true when the condition is met.
 * @param timeout - Maximum wait time in ms (default: 5000).
 * @param interval - Polling interval in ms (default: 50).
 * @throws If the condition is not met within the timeout.
 */
export declare function waitForCondition(fn: () => boolean, timeout?: number, interval?: number): Promise<void>;
//# sourceMappingURL=helpers.d.ts.map