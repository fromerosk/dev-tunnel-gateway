"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const uuid_1 = require("uuid");
const subdomain_1 = require("../shared/subdomain");
const reconnection_1 = require("../shared/reconnection");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const SESSIONS_TABLE_NAME = process.env.SESSIONS_TABLE_NAME ?? '';
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT ?? '';
const HTTP_API_ENDPOINT = process.env.HTTP_API_ENDPOINT ?? '';
/**
 * Adapter that wraps the DynamoDBClient to conform to the DDBClient interface
 * expected by the subdomain module.
 */
const ddbClientAdapter = {
    async query(params) {
        const result = await dynamoClient.send(new client_dynamodb_1.QueryCommand({
            TableName: params.TableName,
            IndexName: params.IndexName,
            KeyConditionExpression: params.KeyConditionExpression,
            ExpressionAttributeValues: Object.fromEntries(Object.entries(params.ExpressionAttributeValues).map(([k, v]) => [
                k,
                { S: v },
            ])),
        }));
        // Convert DynamoDB items to plain objects for the adapter interface
        const items = (result.Items ?? []).map((item) => {
            const obj = {};
            for (const [key, val] of Object.entries(item)) {
                if (val.S !== undefined)
                    obj[key] = val.S;
                else if (val.N !== undefined)
                    obj[key] = Number(val.N);
            }
            return obj;
        });
        return { Items: items };
    },
};
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
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    console.log('Register handler invoked', { connectionId });
    // Parse the register message from the event body
    let message;
    try {
        message = JSON.parse(event.body ?? '{}');
    }
    catch {
        await sendError(connectionId, 'Invalid message format');
        return { statusCode: 400, body: 'Invalid message format' };
    }
    if (!message.localPort || message.localPort < 1 || message.localPort > 65535) {
        await sendError(connectionId, 'Invalid or missing localPort');
        return { statusCode: 400, body: 'Invalid localPort' };
    }
    let subdomain;
    // Reconnection path: validate session token and restore subdomain
    if (message.sessionToken) {
        const reconnectResult = await attemptReconnection(message.sessionToken);
        if (reconnectResult.success) {
            subdomain = reconnectResult.subdomain;
        }
        else {
            await sendError(connectionId, reconnectResult.error);
            return { statusCode: 401, body: reconnectResult.error };
        }
    }
    else {
        // New registration: assign a unique subdomain
        try {
            subdomain = await (0, subdomain_1.assignSubdomain)(ddbClientAdapter);
        }
        catch (err) {
            const errorMsg = 'Failed to assign subdomain';
            console.error(errorMsg, err);
            await sendError(connectionId, errorMsg);
            return { statusCode: 500, body: errorMsg };
        }
    }
    // Generate a new session token for future reconnections
    const sessionToken = (0, uuid_1.v4)();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl = nowSeconds + 3600; // 1 hour TTL
    // Update the session in DynamoDB to ACTIVE
    await dynamoClient.send(new client_dynamodb_1.UpdateItemCommand({
        TableName: SESSIONS_TABLE_NAME,
        Key: {
            connectionId: { S: connectionId },
        },
        UpdateExpression: 'SET #status = :status, subdomain = :subdomain, localPort = :localPort, ' +
            'sessionToken = :sessionToken, updatedAt = :updatedAt, lastHeartbeat = :lastHeartbeat, ' +
            'ttl = :ttl',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':status': { S: 'ACTIVE' },
            ':subdomain': { S: subdomain },
            ':localPort': { N: String(message.localPort) },
            ':sessionToken': { S: sessionToken },
            ':updatedAt': { N: String(nowSeconds) },
            ':lastHeartbeat': { N: String(nowSeconds) },
            ':ttl': { N: String(ttl) },
        },
    }));
    // Construct the public URL
    const publicUrl = `https://${HTTP_API_ENDPOINT}/${subdomain}/`;
    // Build the registration response
    const response = {
        action: 'registered',
        publicUrl,
        subdomain,
        sessionToken,
    };
    // Send the response back to the client via WebSocket
    await postToConnection(connectionId, response);
    console.log('Registration successful', {
        connectionId,
        subdomain,
        publicUrl,
    });
    return { statusCode: 200, body: 'Registered' };
};
exports.handler = handler;
/**
 * Attempts reconnection using a session token.
 * Scans for a session with the matching token and validates the reconnection window.
 */
async function attemptReconnection(sessionToken) {
    // Find the session with the given session token
    const scanResult = await dynamoClient.send(new client_dynamodb_1.ScanCommand({
        TableName: SESSIONS_TABLE_NAME,
        FilterExpression: 'sessionToken = :token',
        ExpressionAttributeValues: {
            ':token': { S: sessionToken },
        },
    }));
    if (!scanResult.Items || scanResult.Items.length === 0) {
        return { success: false, error: 'Session token not found' };
    }
    const session = scanResult.Items[0];
    const storedToken = session.sessionToken?.S ?? '';
    const subdomain = session.subdomain?.S;
    const updatedAt = Number(session.updatedAt?.N ?? '0');
    if (!subdomain) {
        return { success: false, error: 'No subdomain found for session' };
    }
    // Validate the reconnection window
    const now = Date.now();
    const disconnectedAtMs = updatedAt * 1000; // Convert seconds to milliseconds
    const result = (0, reconnection_1.validateReconnection)(sessionToken, storedToken, disconnectedAtMs, now);
    if (!result.canReconnect) {
        const errorMsg = result.reason === 'window_expired'
            ? 'Session token has expired, please establish a new session'
            : 'Invalid session token';
        return { success: false, error: errorMsg };
    }
    return { success: true, subdomain };
}
/**
 * Sends a message to the WebSocket client via API Gateway Management API.
 */
async function postToConnection(connectionId, data) {
    const apiClient = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
        endpoint: WEBSOCKET_API_ENDPOINT,
    });
    await apiClient.send(new client_apigatewaymanagementapi_1.PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
    }));
}
/**
 * Sends an error message to the WebSocket client.
 */
async function sendError(connectionId, message) {
    try {
        await postToConnection(connectionId, {
            action: 'error',
            message,
        });
    }
    catch (err) {
        console.error('Failed to send error to client', { connectionId, err });
    }
}
//# sourceMappingURL=register-handler.js.map