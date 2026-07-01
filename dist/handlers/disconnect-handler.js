"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
/**
 * WebSocket $disconnect route handler.
 * Marks the session as INACTIVE in DynamoDB, sets a 5-minute
 * reconnection window (sessionTokenExpiresAt), and schedules
 * automatic cleanup via TTL (1 hour from now).
 */
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    console.log('Disconnect handler invoked', {
        connectionId,
    });
    const tableName = process.env.SESSIONS_TABLE_NAME ?? '';
    const nowSeconds = Math.floor(Date.now() / 1000);
    const sessionTokenExpiresAt = nowSeconds + 300; // 5-minute reconnection window
    const ttl = nowSeconds + 3600; // 1 hour cleanup
    await dynamoClient.send(new client_dynamodb_1.UpdateItemCommand({
        TableName: tableName,
        Key: {
            connectionId: { S: connectionId },
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, sessionTokenExpiresAt = :sessionTokenExpiresAt, #ttl = :ttl',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
            ':status': { S: 'INACTIVE' },
            ':updatedAt': { N: String(nowSeconds) },
            ':sessionTokenExpiresAt': { N: String(sessionTokenExpiresAt) },
            ':ttl': { N: String(ttl) },
        },
    }));
    return {
        statusCode: 200,
        body: 'Disconnected',
    };
};
exports.handler = handler;
//# sourceMappingURL=disconnect-handler.js.map