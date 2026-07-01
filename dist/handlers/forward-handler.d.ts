import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * HTTP API forward handler.
 *
 * Receives inbound HTTP requests from mobile apps, looks up the active session
 * by subdomain, serializes the request, chunks it if necessary, and forwards
 * it through the WebSocket tunnel to the CLI client. Then polls for the response
 * and returns it to the caller.
 *
 * Route: /{subdomain}/{proxy+}
 *
 * Requirements: 2.1, 2.4, 2.5, 7.4
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
//# sourceMappingURL=forward-handler.d.ts.map