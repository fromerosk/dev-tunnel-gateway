import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { serializeRequest } from '../shared/serializer';
import { chunkMessage } from '../shared/chunker';
import { createErrorResponse, ErrorCode } from '../shared/errors';
import { REQUEST_TIMEOUT_MS } from '../shared/constants';
import { TunnelResponse } from '../shared/types';

const dynamoClient = new DynamoDBClient({});
const SESSIONS_TABLE_NAME = process.env.SESSIONS_TABLE_NAME ?? '';
const PENDING_REQUESTS_TABLE_NAME =
  process.env.PENDING_REQUESTS_TABLE_NAME ?? '';
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT ?? '';

/** Polling interval when waiting for a tunnel response (ms) */
const POLL_INTERVAL_MS = 200;

/**
 * Creates the API Gateway Management API client for sending messages
 * through WebSocket connections.
 */
function createManagementClient(): ApiGatewayManagementApiClient {
  return new ApiGatewayManagementApiClient({
    endpoint: WEBSOCKET_API_ENDPOINT,
  });
}

/**
 * Queries the SubdomainIndex GSI to find an active session for the given subdomain.
 *
 * @returns The connectionId of the active session, or null if none found.
 */
async function findActiveSession(
  subdomain: string
): Promise<string | null> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: SESSIONS_TABLE_NAME,
      IndexName: 'SubdomainIndex',
      KeyConditionExpression: 'subdomain = :subdomain',
      FilterExpression: '#status = :active',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':subdomain': { S: subdomain },
        ':active': { S: 'ACTIVE' },
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0].connectionId?.S ?? null;
}

/**
 * Stores a pending request record in the DevTunnelPendingRequests table.
 */
async function storePendingRequest(
  requestId: string,
  connectionId: string
): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = nowSeconds + 300; // 5 minutes

  await dynamoClient.send(
    new PutItemCommand({
      TableName: PENDING_REQUESTS_TABLE_NAME,
      Item: {
        requestId: { S: requestId },
        connectionId: { S: connectionId },
        status: { S: 'PENDING' },
        createdAt: { N: String(nowSeconds) },
        ttl: { N: String(ttl) },
      },
    })
  );
}

/**
 * Polls the pending requests table until the status becomes COMPLETE
 * or the timeout is reached.
 *
 * @returns The serialized response string, or null if timed out.
 */
async function pollForResponse(requestId: string): Promise<string | null> {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: PENDING_REQUESTS_TABLE_NAME,
        Key: {
          requestId: { S: requestId },
        },
        ProjectionExpression: '#status, #response',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#response': 'response',
        },
      })
    );

    if (result.Item?.status?.S === 'COMPLETE' && result.Item?.response?.S) {
      return result.Item.response.S;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return null;
}

/**
 * HTTP API forward handler.
 *
 * Receives inbound HTTP requests from mobile apps, looks up the active session
 * by subdomain, serializes the request, chunks it if necessary, and forwards
 * it through the WebSocket tunnel to the CLI client. Then polls for the response
 * and returns it to the caller.
 *
 * Route: /{subdomain}/{proxy+}
 *
 * Requirements: 2.1, 2.4, 2.5, 7.4
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const subdomain = event.pathParameters?.subdomain;

  if (!subdomain) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Missing subdomain in path' },
      }),
    };
  }

  console.log('Forward handler invoked', {
    subdomain,
    method: event.httpMethod,
    path: event.path,
  });

  // Step 1: Look up active session by subdomain
  const connectionId = await findActiveSession(subdomain);

  if (!connectionId) {
    console.log('No active session found for subdomain', { subdomain });
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createErrorResponse(ErrorCode.TUNNEL_OFFLINE)),
    };
  }

  // Step 2: Serialize the inbound HTTP request
  // Reconstruct the path relative to the tunnel client (strip the subdomain prefix)
  const proxyPath = event.pathParameters?.proxy
    ? `/${event.pathParameters.proxy}`
    : '/';
  const queryString = event.queryStringParameters
    ? '?' +
      Object.entries(event.queryStringParameters)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`)
        .join('&')
    : '';
  const fullPath = `${proxyPath}${queryString}`;

  const headers: Record<string, string> = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        headers[key] = value;
      }
    }
  }

  const body = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body
    : null;

  const tunnelRequest = serializeRequest(
    event.httpMethod,
    fullPath,
    headers,
    body
  );

  console.log('Serialized tunnel request', {
    requestId: tunnelRequest.requestId,
    method: tunnelRequest.method,
    path: tunnelRequest.path,
    bodySize: tunnelRequest.body?.length ?? 0,
  });

  // Step 3: Chunk the serialized message if > 32KB
  const serializedPayload = JSON.stringify(tunnelRequest);
  const chunks = chunkMessage(serializedPayload, 'request');

  // Step 4: Send chunks via PostToConnection
  const managementClient = createManagementClient();

  try {
    for (const chunk of chunks) {
      await managementClient.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(chunk)),
        })
      );
    }
  } catch (error: unknown) {
    console.error('Failed to send message to tunnel client', {
      connectionId,
      error,
    });
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createErrorResponse(ErrorCode.TUNNEL_OFFLINE)),
    };
  }

  // Step 5: Store pending request in DynamoDB
  await storePendingRequest(tunnelRequest.requestId, connectionId);

  // Step 6: Poll for response (up to 30s timeout)
  const responsePayload = await pollForResponse(tunnelRequest.requestId);

  if (!responsePayload) {
    console.log('Request timed out waiting for tunnel response', {
      requestId: tunnelRequest.requestId,
    });
    return {
      statusCode: 504,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createErrorResponse(ErrorCode.TUNNEL_TIMEOUT)),
    };
  }

  // Step 7: Deserialize and return the response
  const tunnelResponse: TunnelResponse = JSON.parse(responsePayload);

  console.log('Returning tunnel response', {
    requestId: tunnelResponse.requestId,
    statusCode: tunnelResponse.statusCode,
    latencyMs: tunnelResponse.latencyMs,
  });

  // Build response headers
  const responseHeaders: Record<string, string> = {
    ...tunnelResponse.headers,
  };

  // Determine response body
  let responseBody: string | undefined;
  if (tunnelResponse.body !== null) {
    if (tunnelResponse.isBase64Encoded) {
      // Return the base64 body as-is — API Gateway will decode it if the
      // response integration is configured for binary
      responseBody = tunnelResponse.body;
    } else {
      responseBody = tunnelResponse.body;
    }
  }

  return {
    statusCode: tunnelResponse.statusCode,
    headers: responseHeaders,
    body: responseBody ?? '',
    isBase64Encoded: tunnelResponse.isBase64Encoded,
  };
};
