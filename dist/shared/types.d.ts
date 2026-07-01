/**
 * Shared protocol interfaces for the Dev Tunnel Gateway.
 *
 * These types define the wire format for messages exchanged between
 * the tunnel client, WebSocket API Gateway, and Lambda handlers.
 */
/**
 * Serialized HTTP request forwarded through the tunnel.
 * Body is base64-encoded when the content is binary.
 */
export interface TunnelRequest {
    requestId: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
    isBase64Encoded: boolean;
    timestamp: number;
}
/**
 * Serialized HTTP response relayed back through the tunnel.
 * Body is base64-encoded when the content is binary.
 */
export interface TunnelResponse {
    requestId: string;
    statusCode: number;
    headers: Record<string, string>;
    body: string | null;
    isBase64Encoded: boolean;
    latencyMs: number;
}
/**
 * A chunk of a message that exceeds the 32KB WebSocket frame limit.
 * Messages > 32KB are split into chunks of ≤ 28KB each.
 */
export interface ChunkedMessage {
    messageId: string;
    chunkIndex: number;
    totalChunks: number;
    payload: string;
    type: 'request' | 'response';
}
/**
 * A complete message that fits within a single WebSocket frame (≤ 32KB).
 * Represented as a ChunkedMessage with totalChunks = 1.
 */
export interface CompleteMessage {
    messageId: string;
    chunkIndex: 0;
    totalChunks: 1;
    payload: string;
    type: 'request' | 'response';
}
/**
 * Sent by the tunnel client after WebSocket connection is established
 * to register the session and receive a public URL.
 */
export interface RegisterMessage {
    action: 'register';
    localPort: number;
    sessionToken?: string;
}
/**
 * Returned by the gateway after successful registration.
 */
export interface RegisterResponse {
    action: 'registered';
    publicUrl: string;
    subdomain: string;
    sessionToken: string;
}
/**
 * Periodic heartbeat sent by the tunnel client every 30 seconds
 * to keep the session alive.
 */
export interface HeartbeatMessage {
    action: 'heartbeat';
    timestamp: number;
}
/**
 * Acknowledgment returned by the gateway in response to a heartbeat.
 */
export interface HeartbeatAck {
    action: 'heartbeat_ack';
    timestamp: number;
}
/**
 * Response from the GET /health endpoint.
 */
export interface HealthResponse {
    status: 'healthy' | 'degraded';
    canAcceptConnections: boolean;
    activeSessionCount: number;
    timestamp: string;
}
//# sourceMappingURL=types.d.ts.map