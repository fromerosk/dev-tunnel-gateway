import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { v4 as uuidv4 } from 'uuid';
import { assignSubdomain, DDBClient } from '../shared/subdomain';
import { validateReconnection } from '../shared/reconnection';
import type { RegisterMessage, RegisterResponse } from '../shared/types';

const dynamoClient = new DynamoDBClient({});
const SESSIONS_TABLE_NAME = process.env.SESSIONS_TABLE_NAME ?? '';
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT ?? '';
const HTTP_API_ENDPOINT = process.env.HTTP_API_ENDPOINT ?? '';

/**
 * Adapter that wraps the DynamoDBClient to conform to the DDBClient interface
 * expected by the subdomain module.
 */
const ddbClientAdapter: DDBClient = {
  async query(params) {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: params.TableName,
        IndexName: params.IndexName,
        KeyConditionExpression: params.KeyConditionExpression,
        ExpressionAttributeValues: Object.fromEntries(
          Object.entries(params.ExpressionAttributeValues).map(([k, v]) => [
            k,
            { S: v as string },
          ])
        ),
      })
    );
    // Convert DynamoDB items to plain objects for the adapter interface
    const items = (result.Items ?? []).map((item) => {
      const obj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(item)) {
        if (val.S !== undefined) obj[key] = val.S;
        else if (val.N !== undefined) obj[key] = Number(val.N);
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
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId!;

  console.log('Register handler invoked', { connectionId });

  // Parse the register message from the event body
  let message: RegisterMessage;
  try {
    message = JSON.parse(event.body ?? '{}') as RegisterMessage;
  } catch {
    await sendError(connectionId, 'Invalid message format');
    return { statusCode: 400, body: 'Invalid message format' };
  }

  if (!message.localPort || message.localPort < 1 || message.localPort > 65535) {
    await sendError(connectionId, 'Invalid or missing localPort');
    return { statusCode: 400, body: 'Invalid localPort' };
  }

  let subdomain: string;

  // Reconnection path: validate session token and restore subdomain
  if (message.sessionToken) {
    const reconnectResult = await attemptReconnection(message.sessionToken);
    if (reconnectResult.success) {
      subdomain = reconnectResult.subdomain!;
    } else {
      await sendError(connectionId, reconnectResult.error!);
      return { statusCode: 401, body: reconnectResult.error! };
    }
  } else {
    // New registration: assign a unique subdomain
    try {
      subdomain = await assignSubdomain(ddbClientAdapter);
    } catch (err) {
      const errorMsg = 'Failed to assign subdomain';
      console.error(errorMsg, err);
      await sendError(connectionId, errorMsg);
      return { statusCode: 500, body: errorMsg };
    }
  }

  // Generate a new session token for future reconnections
  const sessionToken = uuidv4();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = nowSeconds + 3600; // 1 hour TTL

  // Update the session in DynamoDB to ACTIVE
  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: SESSIONS_TABLE_NAME,
      Key: {
        connectionId: { S: connectionId },
      },
      UpdateExpression:
        'SET #status = :status, subdomain = :subdomain, localPort = :localPort, ' +
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
    })
  );

  // Construct the public URL
  const publicUrl = `https://${HTTP_API_ENDPOINT}/${subdomain}/`;

  // Build the registration response
  const response: RegisterResponse = {
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

/**
 * Attempts reconnection using a session token.
 * Scans for a session with the matching token and validates the reconnection window.
 */
async function attemptReconnection(
  sessionToken: string
): Promise<{ success: boolean; subdomain?: string; error?: string }> {
  // Find the session with the given session token
  const scanResult = await dynamoClient.send(
    new ScanCommand({
      TableName: SESSIONS_TABLE_NAME,
      FilterExpression: 'sessionToken = :token',
      ExpressionAttributeValues: {
        ':token': { S: sessionToken },
      },
    })
  );

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

  const result = validateReconnection(
    sessionToken,
    storedToken,
    disconnectedAtMs,
    now
  );

  if (!result.canReconnect) {
    const errorMsg =
      result.reason === 'window_expired'
        ? 'Session token has expired, please establish a new session'
        : 'Invalid session token';
    return { success: false, error: errorMsg };
  }

  return { success: true, subdomain };
}

/**
 * Sends a message to the WebSocket client via API Gateway Management API.
 */
async function postToConnection(
  connectionId: string,
  data: unknown
): Promise<void> {
  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: WEBSOCKET_API_ENDPOINT,
  });

  await apiClient.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data)),
    })
  );
}

/**
 * Sends an error message to the WebSocket client.
 */
async function sendError(connectionId: string, message: string): Promise<void> {
  try {
    await postToConnection(connectionId, {
      action: 'error',
      message,
    });
  } catch (err) {
    console.error('Failed to send error to client', { connectionId, err });
  }
}
