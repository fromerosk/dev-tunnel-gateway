/**
 * Message serialization and deserialization for the Dev Tunnel Gateway.
 *
 * Handles encoding/decoding of HTTP requests and responses into the tunnel
 * wire format. Binary bodies are base64-encoded; text bodies are passed as-is.
 *
 * Supports bodies up to 10MB (MAX_PAYLOAD_BYTES).
 */
import { TunnelRequest, TunnelResponse } from './types';
/**
 * Serializes an HTTP request into the TunnelRequest wire format.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path including query string
 * @param headers - HTTP headers as key-value pairs
 * @param body - Request body as a string or Buffer, or null if no body
 * @returns A TunnelRequest ready for transmission through the tunnel
 * @throws Error if body exceeds MAX_PAYLOAD_BYTES
 */
export declare function serializeRequest(method: string, path: string, headers: Record<string, string>, body: Buffer | string | null): TunnelRequest;
/**
 * Deserializes a TunnelRequest back into its HTTP components.
 *
 * @param msg - The TunnelRequest message received from the tunnel
 * @returns The original HTTP request components with body as a Buffer
 */
export declare function deserializeRequest(msg: TunnelRequest): {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: Buffer | null;
};
/**
 * Serializes an HTTP response into the TunnelResponse wire format.
 *
 * @param statusCode - HTTP status code
 * @param headers - HTTP response headers as key-value pairs
 * @param body - Response body as a string or Buffer, or null if no body
 * @param requestId - The request ID this response corresponds to
 * @param startTime - The timestamp when the request was received (for latency calculation)
 * @returns A TunnelResponse ready for transmission through the tunnel
 * @throws Error if body exceeds MAX_PAYLOAD_BYTES
 */
export declare function serializeResponse(statusCode: number, headers: Record<string, string>, body: Buffer | string | null, requestId: string, startTime: number): TunnelResponse;
/**
 * Deserializes a TunnelResponse back into its HTTP components.
 *
 * @param msg - The TunnelResponse message received from the tunnel
 * @returns The original HTTP response components with body as a Buffer
 */
export declare function deserializeResponse(msg: TunnelResponse): {
    statusCode: number;
    headers: Record<string, string>;
    body: Buffer | null;
};
//# sourceMappingURL=serializer.d.ts.map