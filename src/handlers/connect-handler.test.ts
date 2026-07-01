import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const { mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue({});
  return { mockSend };
});

vi.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: class {
      send = mockSend;
    },
    PutItemCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

import { handler } from './connect-handler';

function createConnectEvent(overrides: Partial<{
  connectionId: string;
  tokenId: string;
  expiresAt: number;
}> = {}): APIGatewayProxyEvent {
  return {
    requestContext: {
      connectionId: overrides.connectionId ?? 'test-connection-id',
      authorizer: {
        tokenId: overrides.tokenId ?? 'token-123',
        expiresAt: overrides.expiresAt ?? 1700000000,
      },
    } as unknown as APIGatewayProxyEvent['requestContext'],
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
  };
}

describe('connect-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSIONS_TABLE_NAME = 'TestSessionsTable';
  });

  it('returns statusCode 200 with body Connected', async () => {
    const event = createConnectEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('Connected');
  });

  it('calls DynamoDB PutItemCommand with correct session record', async () => {
    const now = Math.floor(Date.now() / 1000);
    const event = createConnectEvent({
      connectionId: 'conn-abc',
      tokenId: 'tok-xyz',
      expiresAt: 1700000000,
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const putCommand = mockSend.mock.calls[0][0];
    const item = putCommand.input.Item;

    expect(putCommand.input.TableName).toBe('TestSessionsTable');
    expect(item.connectionId).toEqual({ S: 'conn-abc' });
    expect(item.status).toEqual({ S: 'PENDING' });
    expect(item.tokenId).toEqual({ S: 'tok-xyz' });
    expect(item.tokenExpiresAt).toEqual({ N: '1700000000' });

    const createdAt = Number(item.createdAt.N);
    const ttl = Number(item.ttl.N);
    expect(createdAt).toBeGreaterThanOrEqual(now - 1);
    expect(createdAt).toBeLessThanOrEqual(now + 1);
    expect(ttl).toBe(createdAt + 3600);
    expect(item.updatedAt).toEqual(item.createdAt);
  });
});
