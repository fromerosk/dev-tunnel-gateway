import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * WebSocket response route handler.
 * Receives proxied HTTP responses from the tunnel client and stores
 * them in the pending requests table for the forward handler to retrieve.
 *
 * Handles both single-chunk (totalChunks === 1) and multi-chunk messages.
 * For multi-chunk messages, partial chunks are stored in the pending requests
 * table keyed by messageId. When all chunks arrive, they are reassembled
 * and the pending request is updated with the complete response.
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
//# sourceMappingURL=response-handler.d.ts.map