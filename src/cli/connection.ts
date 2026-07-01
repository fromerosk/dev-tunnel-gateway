import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { getRetryDelay } from '../shared/backoff';
import { RECONNECT_WINDOW_MS } from '../shared/constants';

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
export class ConnectionManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private _state: ConnectionState = 'disconnected';
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private disconnectedAt: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Session token received after registration, used for reconnection. */
  public sessionToken: string | null = null;

  constructor(
    private readonly gatewayUrl: string,
    private readonly authToken: string,
  ) {
    super();
  }

  /** Current connection state. */
  get state(): ConnectionState {
    return this._state;
  }

  private setState(newState: ConnectionState): void {
    this._state = newState;
    this.emit('stateChange', newState);
  }

  /**
   * Opens a WSS connection to the gateway with the auth token in the query string.
   * Resolves when the connection is established, or rejects if initial connection fails
   * after exhausting all retry attempts.
   */
  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.intentionalClose = false;
      this.reconnectAttempt = 0;
      this.attemptConnection(resolve, reject);
    });
  }

  private attemptConnection(
    resolve?: (value: void) => void,
    reject?: (reason: Error) => void,
  ): void {
    this.setState('connecting');

    const url = this.buildUrl();
    const ws = new WebSocket(url);

    ws.onopen = () => {
      this.ws = ws;
      this.reconnectAttempt = 0;
      this.disconnectedAt = null;
      this.setState('connected');
      this.emit('connected');
      if (resolve) {
        resolve();
      }
    };

    ws.onclose = () => {
      if (this.intentionalClose) {
        this.setState('disconnected');
        this.emit('disconnected', 'intentional close');
        return;
      }

      // Track when disconnection happened
      if (this.disconnectedAt === null) {
        this.disconnectedAt = Date.now();
      }

      this.ws = null;
      this.reconnect(resolve, reject);
    };

    ws.onerror = (err) => {
      // The error event is typically followed by a close event,
      // so reconnection is handled in onclose. We emit for logging only
      // if there is a listener (Node's EventEmitter throws on unhandled 'error').
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
    };

    ws.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : event.data.toString();
      this.emit('message', data);
    };
  }

  private reconnect(
    resolve?: (value: void) => void,
    reject?: (reason: Error) => void,
  ): void {
    // Check if within reconnection window (5 minutes)
    if (this.disconnectedAt !== null) {
      const elapsed = Date.now() - this.disconnectedAt;
      if (elapsed >= RECONNECT_WINDOW_MS) {
        this.setState('disconnected');
        const reason = 'Reconnection window expired';
        this.emit('failed', reason);
        if (reject) {
          reject(new Error(reason));
        }
        return;
      }
    }

    this.reconnectAttempt++;
    const delay = getRetryDelay(this.reconnectAttempt);

    if (delay === null) {
      // Exhausted all retry attempts
      this.setState('disconnected');
      const reason = 'Maximum reconnection attempts exceeded';
      this.emit('failed', reason);
      if (reject) {
        reject(new Error(reason));
      }
      return;
    }

    this.setState('reconnecting');
    this.emit('reconnecting', this.reconnectAttempt);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptConnection(resolve, reject);
    }, delay);
  }

  private buildUrl(): string {
    const separator = this.gatewayUrl.includes('?') ? '&' : '?';
    return `${this.gatewayUrl}${separator}token=${encodeURIComponent(this.authToken)}`;
  }

  /**
   * Sends data through the WebSocket connection.
   * Throws if the connection is not in a connected state.
   */
  send(data: string | Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot send: WebSocket is not connected');
    }
    this.ws.send(data);
  }

  /**
   * Gracefully closes the WebSocket connection.
   * Sets the intentional close flag to prevent reconnection attempts.
   */
  close(): void {
    this.intentionalClose = true;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    this.emit('disconnected', 'intentional close');
  }
}
