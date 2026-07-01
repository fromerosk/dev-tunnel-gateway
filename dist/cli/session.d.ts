import { ConnectionManager } from './connection';
/**
 * Manages tunnel session registration and heartbeat lifecycle.
 *
 * After the WebSocket connection is established, the SessionManager sends
 * a RegisterMessage and waits for a RegisterResponse containing the public URL
 * and session token. It then starts a periodic heartbeat to keep the session alive.
 */
export declare class SessionManager {
    private readonly connection;
    private readonly localPort;
    private heartbeatTimer;
    /** The public URL assigned by the gateway after registration. */
    publicUrl: string | null;
    /** The session token used for reconnection within the 5-minute window. */
    sessionToken: string | null;
    constructor(connection: ConnectionManager, localPort: number);
    /**
     * Sends a RegisterMessage and waits for the RegisterResponse.
     *
     * On success, stores the public URL and session token, sets the session token
     * on the ConnectionManager for reconnection, and prints the public URL to stdout.
     *
     * @param sessionToken - Optional session token for reconnection.
     * @returns The assigned public URL.
     */
    register(sessionToken?: string): Promise<string>;
    /**
     * Starts the heartbeat interval, sending a HeartbeatMessage every 30 seconds.
     * Also listens for HeartbeatAck responses (logged at debug level).
     */
    startHeartbeat(): void;
    /**
     * Stops the heartbeat interval and removes the ack listener.
     */
    stopHeartbeat(): void;
    /**
     * Handles incoming HeartbeatAck messages.
     * Logs at debug level — no further action needed.
     */
    private handleHeartbeatAck;
}
//# sourceMappingURL=session.d.ts.map