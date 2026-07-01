/**
 * Configuration constants for the Dev Tunnel Gateway.
 *
 * These values are derived from the design document and AWS API Gateway limits.
 */

/** Interval between heartbeat messages sent by the tunnel client (ms) */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Window during which a disconnected session can be reconnected (ms) */
export const RECONNECT_WINDOW_MS = 5 * 60 * 1000;

/** Maximum HTTP body size supported by the tunnel (bytes) */
export const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

/** Maximum size of each chunk payload when splitting large messages (bytes) */
export const CHUNK_SIZE_BYTES = 28 * 1024;

/** Maximum WebSocket frame size imposed by API Gateway (bytes) */
export const MAX_FRAME_BYTES = 32 * 1024;

/** Timeout for waiting on a tunnel response before returning 504 (ms) */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum number of connection retry attempts with exponential backoff */
export const MAX_RETRIES = 5;
