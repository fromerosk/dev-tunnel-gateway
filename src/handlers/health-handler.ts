import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import type { HealthResponse } from '../shared/types';

const dynamoClient = new DynamoDBClient({});

/**
 * HTTP API health check handler.
 * Checks DynamoDB connectivity and returns 200 if the gateway
 * can accept new WebSocket connections, or 503 if not.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Health handler invoked', { path: event.path });

  const tableName = process.env.SESSIONS_TABLE_NAME ?? '';

  try {
    // Verify DynamoDB connectivity with a minimal Scan (limit 1)
    await dynamoClient.send(
      new ScanCommand({
        TableName: tableName,
        Limit: 1,
      })
    );

    // Query for active sessions count
    const activeResult = await dynamoClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: '#status = :active',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':active': { S: 'ACTIVE' },
        },
        Select: 'COUNT',
      })
    );

    const response: HealthResponse = {
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
  } catch (error) {
    console.error('Health check failed', { error });

    const response: HealthResponse = {
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
