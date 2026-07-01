"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const SESSIONS_TABLE_NAME = process.env.SESSIONS_TABLE_NAME ?? '';
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT ?? '';
/**
 * WebSocket heartbeat action handler.
 *
 * Handles periodic heartbeat messages from the tunnel client:
 * 1. Parses HeartbeatMessage from event body
 * 2. Updates lastHeartbeat timestamp in DynamoDB session record
 * 3. Sends HeartbeatAck back to the client via PostToConnection
 */
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    console.log('Heartbeat handler invoked', { connectionId });
    // Parse HeartbeatMessage from the event body
    let message;
    try {
        message = JSON.parse(event.body ?? '{}');
    }
    catch {
        console.error('Invalid heartbeat message format', { connectionId });
        return { statusCode: 400, body: 'Invalid message format' };
    }
    if (message.action !== 'heartbeat' || typeof message.timestamp !== 'number') {
        console.error('Invalid heartbeat message', { connectionId, message });
        return { statusCode: 400, body: 'Invalid heartbeat message' };
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    // Update lastHeartbeat and updatedAt in DynamoDB session record
    try {
        await dynamoClient.send(new client_dynamodb_1.UpdateItemCommand({
            TableName: SESSIONS_TABLE_NAME,
            Key: {
                connectionId: { S: connectionId },
            },
            UpdateExpression: 'SET lastHeartbeat = :lastHeartbeat, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':lastHeartbeat': { N: String(nowSeconds) },
                ':updatedAt': { N: String(nowSeconds) },
            },
        }));
    }
    catch (err) {
        console.error('Failed to update heartbeat in DynamoDB', {
            connectionId,
            err,
        });
        return { statusCode: 500, body: 'Internal server error' };
    }
    // Send HeartbeatAck back to the client
    const ack = {
        action: 'heartbeat_ack',
        timestamp: Date.now(),
    };
    try {
        const apiClient = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
            endpoint: WEBSOCKET_API_ENDPOINT,
        });
        await apiClient.send(new client_apigatewaymanagementapi_1.PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(JSON.stringify(ack)),
        }));
    }
    catch (err) {
        console.error('Failed to send heartbeat ack to client', {
            connectionId,
            err,
        });
        // Don't fail the handler if the ack can't be sent — connection might be stale
    }
    console.log('Heartbeat processed', { connectionId, lastHeartbeat: nowSeconds });
    return { statusCode: 200, body: 'OK' };
};
exports.handler = handler;
//# sourceMappingURL=heartbeat-handler.js.map