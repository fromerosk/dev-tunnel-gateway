import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * WebSocket $disconnect route handler.
 * Marks the session as INACTIVE in DynamoDB, sets a 5-minute
 * reconnection window (sessionTokenExpiresAt), and schedules
 * automatic cleanup via TTL (1 hour from now).
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
//# sourceMappingURL=disconnect-handler.d.ts.map