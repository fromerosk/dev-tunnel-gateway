import { ConnectionManager } from './connection';
/**
 * Handles graceful shutdown of the tunnel client on SIGINT/SIGTERM.
 *
 * Waits for in-flight requests to complete (up to 5 seconds),
 * then closes the WebSocket connection and exits with code 0.
 */
export declare class ShutdownHandler {
    private readonly connection;
    private readonly getInFlightCount;
    private _isShuttingDown;
    constructor(connection: ConnectionManager, getInFlightCount: () => number);
    /** Whether the shutdown process has been initiated. */
    get isShuttingDown(): boolean;
    /**
     * Registers SIGINT and SIGTERM signal handlers.
     * When either signal is received, initiates graceful shutdown.
     */
    register(): void;
    private shutdown;
    private waitForInFlight;
}
//# sourceMappingURL=shutdown.d.ts.map