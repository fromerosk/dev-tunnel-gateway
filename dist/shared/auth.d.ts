/**
 * Token validation module for the Dev Tunnel Gateway.
 *
 * Validates authentication tokens against a store of token records,
 * checking both existence and expiration.
 */
/**
 * A stored authentication token record.
 * Tokens are stored in AWS SSM Parameter Store as SecureString parameters.
 */
export interface TokenRecord {
    tokenId: string;
    secret: string;
    expiresAt: number;
    owner: string;
}
/**
 * Result of token validation.
 * - `valid: true` with `tokenId` when the token is authenticated
 * - `valid: false` with `reason: 'invalid'` when no matching token exists
 * - `valid: false` with `reason: 'expired'` and `tokenId` when the token exists but is past expiry
 */
export type TokenValidationResult = {
    valid: true;
    tokenId: string;
} | {
    valid: false;
    reason: 'invalid';
} | {
    valid: false;
    reason: 'expired';
    tokenId: string;
};
/**
 * Validates a token secret against a list of stored token records.
 *
 * A token is valid if and only if:
 * 1. A record with a matching `secret` field exists in `storedTokens`
 * 2. The record's `expiresAt` timestamp is strictly greater than the current time
 *
 * @param tokenSecret - The secret value provided by the client
 * @param storedTokens - The list of known token records to check against
 * @param now - Optional current time in epoch seconds (defaults to `Date.now() / 1000`). Injectable for testing.
 * @returns A `TokenValidationResult` indicating validity and reason for rejection
 */
export declare function validateToken(tokenSecret: string, storedTokens: TokenRecord[], now?: number): TokenValidationResult;
//# sourceMappingURL=auth.d.ts.map