import * as http from 'http';
import { ConnectionManager } from './connection';
import { ChunkBuffer, chunkMessage } from '../shared/chunker';
import { deserializeRequest, serializeResponse } from '../shared/serializer';
import { createErrorResponse, ErrorCode } from '../shared/errors';
import { formatRequestLog } from '../shared/logger';
import { ChunkedMessage, TunnelRequest } from '../shared/types';

/**
 * Forwards incoming tunnel requests to the local development server
 * and relays responses back through the WebSocket connection.
 *
 * Handles chunked message reassembly, local HTTP proxying, error handling
 * for unreachable servers, and response chunking for large payloads.
 */
export class RequestForwarder {
  private chunkBuffer = new ChunkBuffer();
  private messageHandler: ((data: string) => void) | null = null;
  private _inFlightCount = 0;

  /** Number of requests currently being proxied to the local server. */
  get inFlightCount(): number {
    return this._inFlightCount;
  }

  constructor(
    private readonly connection: ConnectionManager,
    private readonly localPort: number,
  ) {}

  /**
   * Starts listening for incoming request messages on the WebSocket connection.
   * Registers a message handler that processes chunked tunnel requests.
   */
  start(): void {
    this.messageHandler = (data: string) => {
      this.handleMessage(data);
    };
    this.connection.on('message', this.messageHandler);
  }

  /**
   * Stops listening for incoming request messages.
   * Removes the message handler from the connection.
   */
  stop(): void {
    if (this.messageHandler) {
      this.connection.off('message', this.messageHandler);
      this.messageHandler = null;
    }
  }

  private handleMessage(data: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      // Not a JSON message we care about, ignore
      return;
    }

    // Check if it's a ChunkedMessage with type 'request'
    if (!this.isChunkedRequest(parsed)) {
      return;
    }

    const chunk = parsed as ChunkedMessage;
    const completed = this.chunkBuffer.addChunk(chunk);

    if (completed !== null) {
      // Reassembled full payload — parse as TunnelRequest and proxy
      let tunnelRequest: TunnelRequest;
      try {
        tunnelRequest = JSON.parse(completed) as TunnelRequest;
      } catch {
        // Malformed request payload, ignore
        return;
      }
      this.proxyToLocal(tunnelRequest);
    }
  }

  private isChunkedRequest(msg: unknown): boolean {
    if (typeof msg !== 'object' || msg === null) {
      return false;
    }
    const obj = msg as Record<string, unknown>;
    return (
      typeof obj.messageId === 'string' &&
      typeof obj.chunkIndex === 'number' &&
      typeof obj.totalChunks === 'number' &&
      typeof obj.payload === 'string' &&
      obj.type === 'request'
    );
  }

  private proxyToLocal(tunnelRequest: TunnelRequest): void {
    this._inFlightCount++;
    const startTime = Date.now();
    const { method, path, headers, body } = deserializeRequest(tunnelRequest);

    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: this.localPort,
      path,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const responseBody = Buffer.concat(chunks);
        const statusCode = res.statusCode ?? 200;
        const responseHeaders: Record<string, string> = {};

        // Flatten response headers to single string values
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') {
            responseHeaders[key] = value;
          } else if (Array.isArray(value)) {
            responseHeaders[key] = value.join(', ');
          }
        }

        const tunnelResponse = serializeResponse(
          statusCode,
          responseHeaders,
          responseBody,
          tunnelRequest.requestId,
          startTime,
        );

        this.sendResponse(tunnelResponse);

        const latencyMs = Date.now() - startTime;
        const logLine = formatRequestLog(method, path, statusCode, latencyMs);
        console.log(logLine);

        this._inFlightCount--;
      });
    });

    req.on('error', (err: NodeJS.ErrnoException) => {
      const latencyMs = Date.now() - startTime;

      if (err.code === 'ECONNREFUSED') {
        // Local server is unreachable
        const errorBody = createErrorResponse(ErrorCode.LOCAL_UNREACHABLE);
        const tunnelResponse = serializeResponse(
          502,
          { 'content-type': 'application/json' },
          JSON.stringify(errorBody),
          tunnelRequest.requestId,
          startTime,
        );

        this.sendResponse(tunnelResponse);

        const logLine = formatRequestLog(method, path, 502, latencyMs);
        console.log(logLine);
        console.error(`[error] Local server not reachable on port ${this.localPort}`);
      } else {
        // Other network error — still send 502
        const errorBody = createErrorResponse(ErrorCode.LOCAL_UNREACHABLE);
        const tunnelResponse = serializeResponse(
          502,
          { 'content-type': 'application/json' },
          JSON.stringify(errorBody),
          tunnelRequest.requestId,
          startTime,
        );

        this.sendResponse(tunnelResponse);

        const logLine = formatRequestLog(method, path, 502, latencyMs);
        console.log(logLine);
        console.error(`[error] Failed to proxy request: ${err.message}`);
      }

      this._inFlightCount--;
    });

    // Write body if present
    if (body !== null) {
      req.write(body);
    }
    req.end();
  }

  private sendResponse(tunnelResponse: unknown): void {
    const payload = JSON.stringify(tunnelResponse);
    const chunks = chunkMessage(payload, 'response');

    for (const chunk of chunks) {
      try {
        this.connection.send(JSON.stringify(chunk));
      } catch {
        // Connection may be closed — log but don't crash
        console.error('[error] Failed to send response chunk through WebSocket');
        break;
      }
    }
  }
}
