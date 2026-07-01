import type { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { validateToken, TokenRecord } from '../shared/auth';

const ssmClient = new SSMClient({});

/** Cached token records and the timestamp they were last fetched. */
let cachedTokens: TokenRecord[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Fetches all token parameters from SSM Parameter Store under the configured path.
 * Results are cached for 60 seconds to reduce SSM API calls.
 */
async function getStoredTokens(): Promise<TokenRecord[]> {
  const now = Date.now();
  if (cachedTokens.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedTokens;
  }

  const parameterPath = process.env.SSM_TOKEN_PARAMETER_PATH ?? '/dev-tunnel/tokens/';
  const tokens: TokenRecord[] = [];
  let nextToken: string | undefined;

  do {
    const command = new GetParametersByPathCommand({
      Path: parameterPath,
      WithDecryption: true,
      NextToken: nextToken,
    });
    const response = await ssmClient.send(command);

    if (response.Parameters) {
      for (const param of response.Parameters) {
        if (!param.Value || !param.Name) continue;
        try {
          const parsed = JSON.parse(param.Value) as { secret: string; expiresAt: number; owner: string };
          // Extract tokenId from the parameter name (last segment of the path)
          const tokenId = param.Name.split('/').pop() ?? param.Name;
          tokens.push({
            tokenId,
            secret: parsed.secret,
            expiresAt: parsed.expiresAt,
            owner: parsed.owner,
          });
        } catch {
          // Skip malformed parameter values
          console.warn('Skipping malformed token parameter', { name: param.Name });
        }
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  cachedTokens = tokens;
  cacheTimestamp = now;
  return tokens;
}

/**
 * Generates an IAM policy document for the API Gateway authorizer response.
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string | number | boolean>,
): APIGatewayAuthorizerResult {
  const result: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };

  if (context) {
    result.context = context;
  }

  return result;
}

/**
 * WebSocket API Lambda Authorizer.
 * Validates authentication tokens against SSM Parameter Store.
 *
 * - Extracts token from query string parameters
 * - Fetches valid tokens from SSM (with 60s cache)
 * - Returns Allow policy with tokenId/expiresAt context on success
 * - Returns Deny policy and logs failure on invalid/expired tokens
 * - Returns Deny immediately if token query param is missing
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const sourceIp = event.requestContext?.identity?.sourceIp ?? 'unknown';
  const methodArn = event.methodArn;

  // Extract token from query string
  const token = event.queryStringParameters?.token;

  if (!token) {
    console.warn('Auth failed: missing token', {
      timestamp: new Date().toISOString(),
      sourceIp,
    });
    return generatePolicy('anonymous', 'Deny', methodArn);
  }

  try {
    const storedTokens = await getStoredTokens();
    const result = validateToken(token, storedTokens);

    if (result.valid) {
      const matchedToken = storedTokens.find((t) => t.tokenId === result.tokenId)!;
      return generatePolicy(result.tokenId, 'Allow', methodArn, {
        tokenId: result.tokenId,
        expiresAt: matchedToken.expiresAt,
      });
    }

    // Invalid or expired token — log and deny
    const reason = result.reason;
    console.warn('Auth failed', {
      timestamp: new Date().toISOString(),
      sourceIp,
      reason,
      tokenId: 'tokenId' in result ? result.tokenId : undefined,
    });

    return generatePolicy('anonymous', 'Deny', methodArn);
  } catch (error) {
    console.error('Auth handler error', {
      timestamp: new Date().toISOString(),
      sourceIp,
      error: error instanceof Error ? error.message : String(error),
    });

    // On unexpected errors, deny access
    return generatePolicy('anonymous', 'Deny', methodArn);
  }
};
