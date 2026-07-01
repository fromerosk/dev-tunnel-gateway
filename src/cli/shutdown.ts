import { ConnectionManager } from './connection';

/**
 * Handles graceful shutdown of the tunnel client on SIGINT/SIGTERM.
 *
 * Waits for in-flight requests to complete (up to 5 seconds),
 * then closes the WebSocket connection and exits with code 0.
 */
export class ShutdownHandler {
  private _isShuttingDown = false;

  constructor(
    private readonly connection: ConnectionManager,
    private readonly getInFlightCount: () => number,
  ) {}

  /** Whether the shutdown process has been initiated. */
  get isShuttingDown(): boolean {
    return this._isShuttingDown;
  }

  /**
   * Registers SIGINT and SIGTERM signal handlers.
   * When either signal is received, initiates graceful shutdown.
   */
  register(): void {
    const handler = () => {
      this.shutdown();
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }

  private shutdown(): void {
    if (this._isShuttingDown) {
      return;
    }

    this._isShuttingDown = true;
    process.stdout.write('\nShutting down...\n');

    this.waitForInFlight().then(() => {
      this.connection.close();
      process.exit(0);
    });
  }

  private waitForInFlight(): Promise<void> {
    return new Promise<void>((resolve) => {
      const maxWaitMs = 5000;
      const pollIntervalMs = 100;
      let elapsed = 0;

      const poll = () => {
        if (this.getInFlightCount() === 0) {
          resolve();
          return;
        }

        elapsed += pollIntervalMs;

        if (elapsed >= maxWaitMs) {
          process.stderr.write('Force closing with in-flight requests\n');
          resolve();
          return;
        }

        setTimeout(poll, pollIntervalMs);
      };

      poll();
    });
  }
}
