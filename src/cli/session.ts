import { ConnectionManager } from './connection';
import { HEARTBEAT_INTERVAL_MS } from '../shared/constants';
import type { RegisterMessage, RegisterResponse, HeartbeatMessage } from '../shared/types';

/**
 * Manages tunnel session registration and heartbeat lifecycle.
 *
 * After the WebSocket connection is established, the SessionManager sends
 * a RegisterMessage and waits for a RegisterResponse containing the public URL
 * and session token. It then starts a periodic heartbeat to keep the session alive.
 */
export class SessionManager {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** The public URL assigned by the gateway after registration. */
  public publicUrl: string | null = null;

  /** The session token used for reconnection within the 5-minute window. */
  public sessionToken: string | null = null;

  constructor(
    private readonly connection: ConnectionManager,
    private readonly localPort: number,
  ) {}

  /**
   * Sends a RegisterMessage and waits for the RegisterResponse.
   *
   * On success, stores the public URL and session token, sets the session token
   * on the ConnectionManager for reconnection, and prints the public URL to stdout.
   *
   * @param sessionToken - Optional session token for reconnection.
   * @returns The assigned public URL.
   */
  register(sessionToken?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const registerMsg: RegisterMessage = {
        action: 'register',
        localPort: this.localPort,
      };

      if (sessionToken) {
        registerMsg.sessionToken = sessionToken;
      }

      const onMessage = (data: string) => {
        try {
          const msg = JSON.parse(data) as Record<string, unknown>;
          if (msg.action === 'registered') {
            this.connection.removeListener('message', onMessage);
            const response = msg as unknown as RegisterResponse;

            this.publicUrl = response.publicUrl;
            this.sessionToken = response.sessionToken;
            this.connection.sessionToken = response.sessionToken;

            process.stdout.write(`✓ Tunnel established! Public URL: ${this.publicUrl}\n`);
            resolve(this.publicUrl);
          }
        } catch {
          // Ignore non-JSON or unrelated messages
        }
      };

      this.connection.on('message', onMessage);

      try {
        this.connection.send(JSON.stringify(registerMsg));
      } catch (err) {
        this.connection.removeListener('message', onMessage);
        reject(err);
      }
    });
  }

  /**
   * Starts the heartbeat interval, sending a HeartbeatMessage every 30 seconds.
   * Also listens for HeartbeatAck responses (logged at debug level).
   */
  startHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      const heartbeat: HeartbeatMessage = {
        action: 'heartbeat',
        timestamp: Date.now(),
      };

      try {
        this.connection.send(JSON.stringify(heartbeat));
      } catch {
        // Connection may be temporarily unavailable during reconnection
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Listen for heartbeat acknowledgments
    this.connection.on('message', this.handleHeartbeatAck);
  }

  /**
   * Stops the heartbeat interval and removes the ack listener.
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.connection.removeListener('message', this.handleHeartbeatAck);
  }

  /**
   * Handles incoming HeartbeatAck messages.
   * Logs at debug level — no further action needed.
   */
  private handleHeartbeatAck = (data: string): void => {
    try {
      const msg = JSON.parse(data) as Record<string, unknown>;
      if (msg.action === 'heartbeat_ack') {
        // Debug-level acknowledgment — session is healthy
      }
    } catch {
      // Ignore non-JSON messages
    }
  };
}
