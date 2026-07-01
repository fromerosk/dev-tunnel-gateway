import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * WebSocket $connect route handler.
 * Creates a new session record in DynamoDB with status PENDING.
 *
 * Extracts connectionId and authorizer context (tokenId, expiresAt)
 * from the event, then writes a session record with a 1-hour TTL.
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
//# sourceMappingURL=connect-handler.d.ts.map