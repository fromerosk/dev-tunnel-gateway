/**
 * Configuration constants for the Dev Tunnel Gateway.
 *
 * These values are derived from the design document and AWS API Gateway limits.
 */
/** Interval between heartbeat messages sent by the tunnel client (ms) */
export declare const HEARTBEAT_INTERVAL_MS = 30000;
/** Window during which a disconnected session can be reconnected (ms) */
export declare const RECONNECT_WINDOW_MS: number;
/** Maximum HTTP body size supported by the tunnel (bytes) */
export declare const MAX_PAYLOAD_BYTES: number;
/** Maximum size of each chunk payload when splitting large messages (bytes) */
export declare const CHUNK_SIZE_BYTES: number;
/** Maximum WebSocket frame size imposed by API Gateway (bytes) */
export declare const MAX_FRAME_BYTES: number;
/** Timeout for waiting on a tunnel response before returning 504 (ms) */
export declare const REQUEST_TIMEOUT_MS = 30000;
/** Maximum number of connection retry attempts with exponential backoff */
export declare const MAX_RETRIES = 5;
//# sourceMappingURL=constants.d.ts.map