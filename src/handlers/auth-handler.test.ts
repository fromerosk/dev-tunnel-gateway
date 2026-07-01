import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayRequestAuthorizerEvent } from 'aws-lambda';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-ssm', () => {
  return {
    SSMClient: class {
      send = mockSend;
    },
    GetParametersByPathCommand: class {
      constructor(public input: unknown) {}
    },
  };
});

function createEvent(overrides: Partial<APIGatewayRequestAuthorizerEvent> = {}): APIGatewayRequestAuthorizerEvent {
  return {
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789:abc123/dev/$connect',
    resource: '$connect',
    path: '/$connect',
    httpMethod: 'GET',
    headers: {},
    multiValueHeaders: {},
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'abc123',
      authorizer: {},
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '192.168.1.100',
        user: null,
        userAgent: null,
        userArn: null,
      },
      path: '/$connect',
      protocol: 'HTTP/1.1',
      requestId: 'req-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/$connect',
      stage: 'dev',
    },
    ...overrides,
  } as APIGatewayRequestAuthorizerEvent;
}

describe('auth-handler', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('should return Deny when token query parameter is missing', async () => {
    const { handler } = await import('./auth-handler');
    const event = createEvent({ queryStringParameters: null });
    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    expect(result.principalId).toBe('anonymous');
    // Should not call SSM
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should return Deny when token query parameter is empty', async () => {
    const { handler } = await import('./auth-handler');
    const event = createEvent({ queryStringParameters: { token: '' } });
    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    expect(result.principalId).toBe('anonymous');
  });

  it('should return Allow with context for a valid token', async () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
    mockSend.mockResolvedValueOnce({
      Parameters: [
        {
          Name: '/dev-tunnel/tokens/token-1',
          Value: JSON.stringify({ secret: 'my-secret-123', expiresAt: futureExpiry, owner: 'dev-user' }),
        },
      ],
      NextToken: undefined,
    });

    const { handler } = await import('./auth-handler');
    const event = createEvent({ queryStringParameters: { token: 'my-secret-123' } });
    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.principalId).toBe('token-1');
    expect(result.context).toEqual({
      tokenId: 'token-1',
      expiresAt: futureExpiry,
    });
  });

  it('should return Deny for an expired token', async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
    mockSend.mockResolvedValueOnce({
      Parameters: [
        {
          Name: '/dev-tunnel/tokens/token-expired',
          Value: JSON.stringify({ secret: 'expired-secret', expiresAt: pastExpiry, owner: 'dev-user' }),
        },
      ],
      NextToken: undefined,
    });

    const { handler } = await import('./auth-handler');
    const event = createEvent({ queryStringParameters: { token: 'expired-secret' } });
    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    expect(result.principalId).toBe('anonymous');
  });

  it('should return Deny for a token not found in store', async () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
    mockSend.mockResolvedValueOnce({
      Parameters: [
        {
          Name: '/dev-tunnel/tokens/token-1',
          Value: JSON.stringify({ secret: 'actual-secret', expiresAt: futureExpiry, owner: 'dev-user' }),
        },
      ],
      NextToken: undefined,
    });

    const { handler } = await import('./auth-handler');
    const event = createEvent({ queryStringParameters: { token: 'wrong-secret' } });
    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    expect(result.principalId).toBe('anonymous');
  });

  it('should return Deny when SSM call fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('SSM access denied'));

    const { handler } = await import('./auth-handler');
    const event = createEvent({ queryStringParameters: { token: 'some-token' } });
    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    expect(result.principalId).toBe('anonymous');
  });

  it('should use correct methodArn in policy Resource', async () => {
    const { handler } = await import('./auth-handler');
    const event = createEvent({
      queryStringParameters: null,
      methodArn: 'arn:aws:execute-api:us-west-2:999:xyz/prod/$connect',
    });
    const result = await handler(event);

    const statement = result.policyDocument.Statement[0] as { Resource: string };
    expect(statement.Resource).toBe(
      'arn:aws:execute-api:us-west-2:999:xyz/prod/$connect',
    );
  });
});
