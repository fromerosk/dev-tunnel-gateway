import type { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
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
export declare const handler: (event: APIGatewayRequestAuthorizerEvent) => Promise<APIGatewayAuthorizerResult>;
//# sourceMappingURL=auth-handler.d.ts.map