"use strict";
/**
 * Configuration constants for the Dev Tunnel Gateway.
 *
 * These values are derived from the design document and AWS API Gateway limits.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RETRIES = exports.REQUEST_TIMEOUT_MS = exports.MAX_FRAME_BYTES = exports.CHUNK_SIZE_BYTES = exports.MAX_PAYLOAD_BYTES = exports.RECONNECT_WINDOW_MS = exports.HEARTBEAT_INTERVAL_MS = void 0;
/** Interval between heartbeat messages sent by the tunnel client (ms) */
exports.HEARTBEAT_INTERVAL_MS = 30_000;
/** Window during which a disconnected session can be reconnected (ms) */
exports.RECONNECT_WINDOW_MS = 5 * 60 * 1000;
/** Maximum HTTP body size supported by the tunnel (bytes) */
exports.MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;
/** Maximum size of each chunk payload when splitting large messages (bytes) */
exports.CHUNK_SIZE_BYTES = 28 * 1024;
/** Maximum WebSocket frame size imposed by API Gateway (bytes) */
exports.MAX_FRAME_BYTES = 32 * 1024;
/** Timeout for waiting on a tunnel response before returning 504 (ms) */
exports.REQUEST_TIMEOUT_MS = 30_000;
/** Maximum number of connection retry attempts with exponential backoff */
exports.MAX_RETRIES = 5;
//# sourceMappingURL=constants.js.map