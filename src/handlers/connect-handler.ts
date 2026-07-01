import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

/**
 * WebSocket $connect route handler.
 * Creates a new session record in DynamoDB with status PENDING.
 *
 * Extracts connectionId and authorizer context (tokenId, expiresAt)
 * from the event, then writes a session record with a 1-hour TTL.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  const authorizer = event.requestContext.authorizer ?? {};
  const tokenId = authorizer.tokenId as string;
  const tokenExpiresAt = Number(authorizer.expiresAt);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = nowSeconds + 3600; // 1 hour from now

  console.log('Connect handler invoked', {
    connectionId,
    tokenId,
  });

  const tableName = process.env.SESSIONS_TABLE_NAME ?? '';

  await dynamoClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: {
        connectionId: { S: connectionId! },
        status: { S: 'PENDING' },
        tokenId: { S: tokenId },
        tokenExpiresAt: { N: String(tokenExpiresAt) },
        createdAt: { N: String(nowSeconds) },
        updatedAt: { N: String(nowSeconds) },
        ttl: { N: String(ttl) },
      },
    })
  );

  return {
    statusCode: 200,
    body: 'Connected',
  };
};
