import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import type { ChunkedMessage, TunnelResponse } from '../shared/types';

const dynamoClient = new DynamoDBClient({});
const PENDING_REQUESTS_TABLE_NAME =
  process.env.PENDING_REQUESTS_TABLE_NAME ?? '';

/**
 * WebSocket response route handler.
 * Receives proxied HTTP responses from the tunnel client and stores
 * them in the pending requests table for the forward handler to retrieve.
 *
 * Handles both single-chunk (totalChunks === 1) and multi-chunk messages.
 * For multi-chunk messages, partial chunks are stored in the pending requests
 * table keyed by messageId. When all chunks arrive, they are reassembled
 * and the pending request is updated with the complete response.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Response handler invoked', {
    connectionId: event.requestContext.connectionId,
  });

  try {
    const chunk: ChunkedMessage = JSON.parse(event.body ?? '{}');
    const { messageId, chunkIndex, totalChunks, payload } = chunk;

    if (!messageId || totalChunks === undefined || chunkIndex === undefined) {
      console.error('Invalid chunk message: missing required fields');
      return {
        statusCode: 400,
        body: 'Invalid message format',
      };
    }

    let completePayload: string;

    if (totalChunks === 1) {
      // Single-chunk message — payload is the complete response
      completePayload = payload;
    } else {
      // Multi-chunk message — store chunk and check if all have arrived
      const assembled = await handleMultiChunk(
        messageId,
        chunkIndex,
        totalChunks,
        payload
      );

      if (!assembled) {
        // Not all chunks received yet
        return {
          statusCode: 200,
          body: 'Chunk received',
        };
      }

      completePayload = assembled;
    }

    // Parse the reassembled response to extract requestId
    const tunnelResponse: TunnelResponse = JSON.parse(completePayload);
    const { requestId } = tunnelResponse;

    // Update the pending request record with the complete response
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: PENDING_REQUESTS_TABLE_NAME,
        Key: {
          requestId: { S: requestId },
        },
        UpdateExpression:
          'SET #status = :status, #response = :response, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#response': 'response',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'COMPLETE' },
          ':response': { S: completePayload },
          ':now': { N: String(Math.floor(Date.now() / 1000)) },
        },
      })
    );

    console.log('Response stored for request', { requestId });

    return {
      statusCode: 200,
      body: 'Response received',
    };
  } catch (error) {
    console.error('Error processing response', { error });
    return {
      statusCode: 500,
      body: 'Internal error processing response',
    };
  }
};

/**
 * Handles a multi-chunk message by storing individual chunks in DynamoDB
 * and reassembling when all chunks have arrived.
 *
 * Chunks are tracked using a DynamoDB item keyed by `chunk#<messageId>` in the
 * pending requests table. Each arriving chunk increments a counter and stores
 * its payload indexed by chunkIndex. When the counter reaches totalChunks,
 * all chunks are reassembled in order.
 *
 * @returns The reassembled payload when all chunks arrive, or null
 *          if more chunks are still needed.
 */
async function handleMultiChunk(
  messageId: string,
  chunkIndex: number,
  totalChunks: number,
  payload: string
): Promise<string | null> {
  const chunkKey = `chunk#${messageId}`;
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Store this chunk and atomically increment the received count.
  // Uses ADD for the counter and SET for the chunk payload.
  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: PENDING_REQUESTS_TABLE_NAME,
      Key: {
        requestId: { S: chunkKey },
      },
      UpdateExpression:
        'SET #chunk = :payload, totalChunks = :total, updatedAt = :now, #ttl = :ttl ADD receivedCount :one',
      ExpressionAttributeNames: {
        '#chunk': `chunk_${chunkIndex}`,
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':payload': { S: payload },
        ':total': { N: String(totalChunks) },
        ':now': { N: String(nowSeconds) },
        ':ttl': { N: String(nowSeconds + 60) },
        ':one': { N: '1' },
      },
    })
  );

  // Read back the record to check if all chunks have arrived
  const result = await dynamoClient.send(
    new GetItemCommand({
      TableName: PENDING_REQUESTS_TABLE_NAME,
      Key: {
        requestId: { S: chunkKey },
      },
      ConsistentRead: true,
    })
  );

  const item = result.Item;
  if (!item) {
    return null;
  }

  const receivedCount = Number(item.receivedCount?.N ?? '0');

  if (receivedCount < totalChunks) {
    // Still waiting for more chunks
    return null;
  }

  // All chunks received — reassemble in order
  const parts: string[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkPayload = item[`chunk_${i}`]?.S;
    if (!chunkPayload) {
      console.error('Missing chunk during reassembly', {
        messageId,
        index: i,
      });
      return null;
    }
    parts.push(chunkPayload);
  }

  return parts.join('');
}
