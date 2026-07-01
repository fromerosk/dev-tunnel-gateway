import { describe, it, expect } from 'vitest';
import { validateToken, TokenRecord } from './auth';

describe('validateToken', () => {
  const now = 1000000;

  const storedTokens: TokenRecord[] = [
    { tokenId: 'token-1', secret: 'secret-abc', expiresAt: now + 3600, owner: 'dev-1' },
    { tokenId: 'token-2', secret: 'secret-def', expiresAt: now - 100, owner: 'dev-2' },
    { tokenId: 'token-3', secret: 'secret-ghi', expiresAt: now, owner: 'dev-3' },
  ];

  it('returns valid with tokenId for a matching, non-expired token', () => {
    const result = validateToken('secret-abc', storedTokens, now);
    expect(result).toEqual({ valid: true, tokenId: 'token-1' });
  });

  it('returns invalid when no matching secret exists', () => {
    const result = validateToken('nonexistent-secret', storedTokens, now);
    expect(result).toEqual({ valid: false, reason: 'invalid' });
  });

  it('returns expired with tokenId when token exists but is past expiry', () => {
    const result = validateToken('secret-def', storedTokens, now);
    expect(result).toEqual({ valid: false, reason: 'expired', tokenId: 'token-2' });
  });

  it('returns expired when expiresAt equals current time (not strictly greater)', () => {
    const result = validateToken('secret-ghi', storedTokens, now);
    expect(result).toEqual({ valid: false, reason: 'expired', tokenId: 'token-3' });
  });

  it('returns invalid when storedTokens is empty', () => {
    const result = validateToken('any-secret', [], now);
    expect(result).toEqual({ valid: false, reason: 'invalid' });
  });

  it('returns invalid for empty token secret', () => {
    const result = validateToken('', storedTokens, now);
    expect(result).toEqual({ valid: false, reason: 'invalid' });
  });

  it('uses Date.now() when no now parameter is provided', () => {
    const futureToken: TokenRecord[] = [
      { tokenId: 'future', secret: 'future-secret', expiresAt: Date.now() / 1000 + 9999, owner: 'dev' },
    ];
    const result = validateToken('future-secret', futureToken);
    expect(result).toEqual({ valid: true, tokenId: 'future' });
  });
});
