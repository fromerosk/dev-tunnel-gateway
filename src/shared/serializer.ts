/**
 * Message serialization and deserialization for the Dev Tunnel Gateway.
 *
 * Handles encoding/decoding of HTTP requests and responses into the tunnel
 * wire format. Binary bodies are base64-encoded; text bodies are passed as-is.
 *
 * Supports bodies up to 10MB (MAX_PAYLOAD_BYTES).
 */

import { v4 as uuidv4 } from 'uuid';
import { TunnelRequest, TunnelResponse } from './types';
import { MAX_PAYLOAD_BYTES } from './constants';

/**
 * Determines whether a Buffer contains binary (non-text) content.
 *
 * A buffer is considered binary if:
 * - It contains NULL bytes (0x00)
 * - It contains control characters other than tab, newline, carriage return
 * - Its content does not survive a UTF-8 round-trip (encode → decode → encode)
 */
function isBinaryBuffer(buffer: Buffer): boolean {
  // Check a sample of the buffer for obvious binary indicators
  const sampleSize = Math.min(buffer.length, 8192);
  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    // NULL byte is a strong binary indicator
    if (byte === 0x00) return true;
    // Control characters (except tab=9, newline=10, carriage return=13) indicate binary
    if (byte < 0x09) return true;
    if (byte > 0x0d && byte < 0x20) return true;
    if (byte === 0x7f) return true;
  }

  // Check if content survives a UTF-8 round-trip
  const decoded = buffer.toString('utf-8');
  const reEncoded = Buffer.from(decoded, 'utf-8');
  if (!buffer.equals(reEncoded)) {
    return true;
  }

  return false;
}

/**
 * Determines whether content should be treated as binary based on
 * Content-Type header or body content inspection.
 */
function shouldBase64Encode(
  body: Buffer | string | null,
  headers?: Record<string, string>
): boolean {
  if (body === null) return false;

  // If body is a Buffer, check its content
  if (Buffer.isBuffer(body)) {
    return isBinaryBuffer(body);
  }

  // For strings, check Content-Type header for binary indicators
  if (headers) {
    const contentType = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === 'content-type'
    )?.[1];

    if (contentType) {
      const textTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/javascript',
        'application/x-www-form-urlencoded',
      ];
      const isTextType = textTypes.some((t) =>
        contentType.toLowerCase().includes(t)
      );
      if (!isTextType && contentType.toLowerCase().includes('application/')) {
        return true;
      }
    }
  }

  // For strings, check if they contain non-UTF8 characters
  const buf = Buffer.from(body, 'utf-8');
  const roundTripped = buf.toString('utf-8');
  if (roundTripped !== body) {
    return true;
  }

  return false;
}

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
export function serializeRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Buffer | string | null
): TunnelRequest {
  if (body !== null) {
    const size = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
    if (size > MAX_PAYLOAD_BYTES) {
      throw new Error(
        `Body size ${size} exceeds maximum payload size of ${MAX_PAYLOAD_BYTES} bytes`
      );
    }
  }

  let serializedBody: string | null = null;
  let isBase64Encoded = false;

  if (body !== null) {
    if (Buffer.isBuffer(body)) {
      if (isBinaryBuffer(body)) {
        serializedBody = body.toString('base64');
        isBase64Encoded = true;
      } else {
        serializedBody = body.toString('utf-8');
        isBase64Encoded = false;
      }
    } else {
      if (shouldBase64Encode(body, headers)) {
        serializedBody = Buffer.from(body).toString('base64');
        isBase64Encoded = true;
      } else {
        serializedBody = body;
        isBase64Encoded = false;
      }
    }
  }

  return {
    requestId: uuidv4(),
    method,
    path,
    headers,
    body: serializedBody,
    isBase64Encoded,
    timestamp: Date.now(),
  };
}

/**
 * Deserializes a TunnelRequest back into its HTTP components.
 *
 * @param msg - The TunnelRequest message received from the tunnel
 * @returns The original HTTP request components with body as a Buffer
 */
export function deserializeRequest(msg: TunnelRequest): {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Buffer | null;
} {
  let body: Buffer | null = null;

  if (msg.body !== null) {
    if (msg.isBase64Encoded) {
      body = Buffer.from(msg.body, 'base64');
    } else {
      body = Buffer.from(msg.body, 'utf-8');
    }
  }

  return {
    method: msg.method,
    path: msg.path,
    headers: msg.headers,
    body,
  };
}

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
export function serializeResponse(
  statusCode: number,
  headers: Record<string, string>,
  body: Buffer | string | null,
  requestId: string,
  startTime: number
): TunnelResponse {
  if (body !== null) {
    const size = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
    if (size > MAX_PAYLOAD_BYTES) {
      throw new Error(
        `Body size ${size} exceeds maximum payload size of ${MAX_PAYLOAD_BYTES} bytes`
      );
    }
  }

  let serializedBody: string | null = null;
  let isBase64Encoded = false;

  if (body !== null) {
    if (Buffer.isBuffer(body)) {
      if (isBinaryBuffer(body)) {
        serializedBody = body.toString('base64');
        isBase64Encoded = true;
      } else {
        serializedBody = body.toString('utf-8');
        isBase64Encoded = false;
      }
    } else {
      if (shouldBase64Encode(body, headers)) {
        serializedBody = Buffer.from(body).toString('base64');
        isBase64Encoded = true;
      } else {
        serializedBody = body;
        isBase64Encoded = false;
      }
    }
  }

  return {
    requestId,
    statusCode,
    headers,
    body: serializedBody,
    isBase64Encoded,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Deserializes a TunnelResponse back into its HTTP components.
 *
 * @param msg - The TunnelResponse message received from the tunnel
 * @returns The original HTTP response components with body as a Buffer
 */
export function deserializeResponse(msg: TunnelResponse): {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer | null;
} {
  let body: Buffer | null = null;

  if (msg.body !== null) {
    if (msg.isBase64Encoded) {
      body = Buffer.from(msg.body, 'base64');
    } else {
      body = Buffer.from(msg.body, 'utf-8');
    }
  }

  return {
    statusCode: msg.statusCode,
    headers: msg.headers,
    body,
  };
}
