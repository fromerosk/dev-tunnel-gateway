import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

/**
 * WebSocket $disconnect route handler.
 * Marks the session as INACTIVE in DynamoDB, sets a 5-minute
 * reconnection window (sessionTokenExpiresAt), and schedules
 * automatic cleanup via TTL (1 hour from now).
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;

  console.log('Disconnect handler invoked', {
    connectionId,
  });

  const tableName = process.env.SESSIONS_TABLE_NAME ?? '';
  const nowSeconds = Math.floor(Date.now() / 1000);
  const sessionTokenExpiresAt = nowSeconds + 300; // 5-minute reconnection window
  const ttl = nowSeconds + 3600; // 1 hour cleanup

  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: {
        connectionId: { S: connectionId! },
      },
      UpdateExpression:
        'SET #status = :status, updatedAt = :updatedAt, sessionTokenExpiresAt = :sessionTokenExpiresAt, #ttl = :ttl',
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
    })
  );

  return {
    statusCode: 200,
    body: 'Disconnected',
  };
};
