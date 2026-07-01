"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const auth_1 = require("./auth");
(0, vitest_1.describe)('validateToken', () => {
    const now = 1000000;
    const storedTokens = [
        { tokenId: 'token-1', secret: 'secret-abc', expiresAt: now + 3600, owner: 'dev-1' },
        { tokenId: 'token-2', secret: 'secret-def', expiresAt: now - 100, owner: 'dev-2' },
        { tokenId: 'token-3', secret: 'secret-ghi', expiresAt: now, owner: 'dev-3' },
    ];
    (0, vitest_1.it)('returns valid with tokenId for a matching, non-expired token', () => {
        const result = (0, auth_1.validateToken)('secret-abc', storedTokens, now);
        (0, vitest_1.expect)(result).toEqual({ valid: true, tokenId: 'token-1' });
    });
    (0, vitest_1.it)('returns invalid when no matching secret exists', () => {
        const result = (0, auth_1.validateToken)('nonexistent-secret', storedTokens, now);
        (0, vitest_1.expect)(result).toEqual({ valid: false, reason: 'invalid' });
    });
    (0, vitest_1.it)('returns expired with tokenId when token exists but is past expiry', () => {
        const result = (0, auth_1.validateToken)('secret-def', storedTokens, now);
        (0, vitest_1.expect)(result).toEqual({ valid: false, reason: 'expired', tokenId: 'token-2' });
    });
    (0, vitest_1.it)('returns expired when expiresAt equals current time (not strictly greater)', () => {
        const result = (0, auth_1.validateToken)('secret-ghi', storedTokens, now);
        (0, vitest_1.expect)(result).toEqual({ valid: false, reason: 'expired', tokenId: 'token-3' });
    });
    (0, vitest_1.it)('returns invalid when storedTokens is empty', () => {
        const result = (0, auth_1.validateToken)('any-secret', [], now);
        (0, vitest_1.expect)(result).toEqual({ valid: false, reason: 'invalid' });
    });
    (0, vitest_1.it)('returns invalid for empty token secret', () => {
        const result = (0, auth_1.validateToken)('', storedTokens, now);
        (0, vitest_1.expect)(result).toEqual({ valid: false, reason: 'invalid' });
    });
    (0, vitest_1.it)('uses Date.now() when no now parameter is provided', () => {
        const futureToken = [
            { tokenId: 'future', secret: 'future-secret', expiresAt: Date.now() / 1000 + 9999, owner: 'dev' },
        ];
        const result = (0, auth_1.validateToken)('future-secret', futureToken);
        (0, vitest_1.expect)(result).toEqual({ valid: true, tokenId: 'future' });
    });
});
//# sourceMappingURL=auth.test.js.map