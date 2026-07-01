import { ConnectionManager } from './connection';
/**
 * Forwards incoming tunnel requests to the local development server
 * and relays responses back through the WebSocket connection.
 *
 * Handles chunked message reassembly, local HTTP proxying, error handling
 * for unreachable servers, and response chunking for large payloads.
 */
export declare class RequestForwarder {
    private readonly connection;
    private readonly localPort;
    private chunkBuffer;
    private messageHandler;
    private _inFlightCount;
    /** Number of requests currently being proxied to the local server. */
    get inFlightCount(): number;
    constructor(connection: ConnectionManager, localPort: number);
    /**
     * Starts listening for incoming request messages on the WebSocket connection.
     * Registers a message handler that processes chunked tunnel requests.
     */
    start(): void;
    /**
     * Stops listening for incoming request messages.
     * Removes the message handler from the connection.
     */
    stop(): void;
    private handleMessage;
    private isChunkedRequest;
    private proxyToLocal;
    private sendResponse;
}
//# sourceMappingURL=forwarder.d.ts.map