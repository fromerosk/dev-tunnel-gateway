import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * HTTP API health check handler.
 * Checks DynamoDB connectivity and returns 200 if the gateway
 * can accept new WebSocket connections, or 503 if not.
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
//# sourceMappingURL=health-handler.d.ts.map