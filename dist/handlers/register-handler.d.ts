import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * WebSocket register action handler.
 *
 * Handles tunnel registration:
 * 1. Parses the RegisterMessage from the event body
 * 2. If sessionToken provided: validates reconnection window and restores subdomain
 * 3. Otherwise: generates a unique 8-char subdomain
 * 4. Updates session to ACTIVE with subdomain, localPort, and new sessionToken
 * 5. Sends RegisterResponse back to client with public URL
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
//# sourceMappingURL=register-handler.d.ts.map