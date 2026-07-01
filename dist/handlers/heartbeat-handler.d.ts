import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * WebSocket heartbeat action handler.
 *
 * Handles periodic heartbeat messages from the tunnel client:
 * 1. Parses HeartbeatMessage from event body
 * 2. Updates lastHeartbeat timestamp in DynamoDB session record
 * 3. Sends HeartbeatAck back to the client via PostToConnection
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
//# sourceMappingURL=heartbeat-handler.d.ts.map