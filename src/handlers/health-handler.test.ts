import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { HealthResponse } from '../shared/types';

const { mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  return { mockSend };
});

vi.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: class {
      send = mockSend;
    },
    ScanCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

import { handler } from './health-handler';

function createHealthEvent(): APIGatewayProxyEvent {
  return {
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/health',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
  };
}

describe('health-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSIONS_TABLE_NAME = 'TestSessionsTable';
  });

  it('returns 200 with healthy status when DynamoDB is reachable', async () => {
    // First call: connectivity check (Scan limit 1)
    mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
    // Second call: active sessions count
    mockSend.mockResolvedValueOnce({ Count: 3 });

    const result = await handler(createHealthEvent());
    const body: HealthResponse = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.canAcceptConnections).toBe(true);
    expect(body.activeSessionCount).toBe(3);
    expect(body.timestamp).toBeDefined();
  });

  it('returns 503 with degraded status when DynamoDB is unreachable', async () => {
    mockSend.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await handler(createHealthEvent());
    const body: HealthResponse = JSON.parse(result.body);

    expect(result.statusCode).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.canAcceptConnections).toBe(false);
    expect(body.activeSessionCount).toBe(0);
    expect(body.timestamp).toBeDefined();
  });

  it('returns activeSessionCount of 0 when no active sessions exist', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
    mockSend.mockResolvedValueOnce({ Count: 0 });

    const result = await handler(createHealthEvent());
    const body: HealthResponse = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.activeSessionCount).toBe(0);
  });

  it('sets Content-Type header to application/json', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
    mockSend.mockResolvedValueOnce({ Count: 1 });

    const result = await handler(createHealthEvent());

    expect(result.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('makes two DynamoDB calls: connectivity check and active count', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
    mockSend.mockResolvedValueOnce({ Count: 5 });

    await handler(createHealthEvent());

    expect(mockSend).toHaveBeenCalledTimes(2);

    // First call: connectivity scan with Limit 1
    const firstCall = mockSend.mock.calls[0][0];
    expect(firstCall.input.TableName).toBe('TestSessionsTable');
    expect(firstCall.input.Limit).toBe(1);

    // Second call: active sessions count
    const secondCall = mockSend.mock.calls[1][0];
    expect(secondCall.input.TableName).toBe('TestSessionsTable');
    expect(secondCall.input.Select).toBe('COUNT');
    expect(secondCall.input.FilterExpression).toBe('#status = :active');
    expect(secondCall.input.ExpressionAttributeValues).toEqual({
      ':active': { S: 'ACTIVE' },
    });
  });

  it('returns 503 if the active sessions count query fails', async () => {
    // Connectivity check succeeds
    mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
    // Active count fails
    mockSend.mockRejectedValueOnce(new Error('Throttled'));

    const result = await handler(createHealthEvent());
    const body: HealthResponse = JSON.parse(result.body);

    expect(result.statusCode).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.canAcceptConnections).toBe(false);
  });
});
