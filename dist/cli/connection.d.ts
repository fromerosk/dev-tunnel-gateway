import { EventEmitter } from 'events';
/**
 * Connection states for the WebSocket tunnel connection.
 */
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
/**
 * Events emitted by the ConnectionManager.
 */
export interface ConnectionManagerEvents {
    connected: () => void;
    disconnected: (reason: string) => void;
    reconnecting: (attempt: number) => void;
    failed: (reason: string) => void;
    message: (data: string) => void;
    stateChange: (state: ConnectionState) => void;
}
/**
 * Manages the WebSocket connection to the dev tunnel gateway.
 *
 * Handles initial connection, exponential backoff reconnection,
 * and connection lifecycle events. Supports session token-based
 * reconnection within the 5-minute reconnection window.
 */
export declare class ConnectionManager extends EventEmitter {
    private readonly gatewayUrl;
    private readonly authToken;
    private ws;
    private _state;
    private intentionalClose;
    private reconnectAttempt;
    private disconnectedAt;
    private reconnectTimer;
    /** Session token received after registration, used for reconnection. */
    sessionToken: string | null;
    constructor(gatewayUrl: string, authToken: string);
    /** Current connection state. */
    get state(): ConnectionState;
    private setState;
    /**
     * Opens a WSS connection to the gateway with the auth token in the query string.
     * Resolves when the connection is established, or rejects if initial connection fails
     * after exhausting all retry attempts.
     */
    connect(): Promise<void>;
    private attemptConnection;
    private reconnect;
    private buildUrl;
    /**
     * Sends data through the WebSocket connection.
     * Throws if the connection is not in a connected state.
     */
    send(data: string | Buffer): void;
    /**
     * Gracefully closes the WebSocket connection.
     * Sets the intentional close flag to prevent reconnection attempts.
     */
    close(): void;
}
//# sourceMappingURL=connection.d.ts.map