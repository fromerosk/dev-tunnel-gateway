"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
/**
 * HTTP API health check handler.
 * Checks DynamoDB connectivity and returns 200 if the gateway
 * can accept new WebSocket connections, or 503 if not.
 */
const handler = async (event) => {
    console.log('Health handler invoked', { path: event.path });
    const tableName = process.env.SESSIONS_TABLE_NAME ?? '';
    try {
        // Verify DynamoDB connectivity with a minimal Scan (limit 1)
        await dynamoClient.send(new client_dynamodb_1.ScanCommand({
            TableName: tableName,
            Limit: 1,
        }));
        // Query for active sessions count
        const activeResult = await dynamoClient.send(new client_dynamodb_1.ScanCommand({
            TableName: tableName,
            FilterExpression: '#status = :active',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':active': { S: 'ACTIVE' },
            },
            Select: 'COUNT',
        }));
        const response = {
            status: 'healthy',
            canAcceptConnections: true,
            activeSessionCount: activeResult.Count ?? 0,
            timestamp: new Date().toISOString(),
        };
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
        };
    }
    catch (error) {
        console.error('Health check failed', { error });
        const response = {
            status: 'degraded',
            canAcceptConnections: false,
            activeSessionCount: 0,
            timestamp: new Date().toISOString(),
        };
        return {
            statusCode: 503,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=health-handler.js.map