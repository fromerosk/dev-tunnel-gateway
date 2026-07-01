"use strict";
/**
 * Token validation module for the Dev Tunnel Gateway.
 *
 * Validates authentication tokens against a store of token records,
 * checking both existence and expiration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateToken = validateToken;
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
function validateToken(tokenSecret, storedTokens, now) {
    const currentTime = now ?? Date.now() / 1000;
    const record = storedTokens.find((r) => r.secret === tokenSecret);
    if (!record) {
        return { valid: false, reason: 'invalid' };
    }
    if (record.expiresAt <= currentTime) {
        return { valid: false, reason: 'expired', tokenId: record.tokenId };
    }
    return { valid: true, tokenId: record.tokenId };
}
//# sourceMappingURL=auth.js.map