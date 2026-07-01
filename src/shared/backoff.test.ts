import { describe, it, expect } from 'vitest';
import { getRetryDelay } from './backoff';

describe('getRetryDelay', () => {
  it('returns 1000ms for attempt 1', () => {
    expect(getRetryDelay(1)).toBe(1000);
  });

  it('returns 2000ms for attempt 2', () => {
    expect(getRetryDelay(2)).toBe(2000);
  });

  it('returns 4000ms for attempt 3', () => {
    expect(getRetryDelay(3)).toBe(4000);
  });

  it('returns 8000ms for attempt 4', () => {
    expect(getRetryDelay(4)).toBe(8000);
  });

  it('returns 16000ms for attempt 5', () => {
    expect(getRetryDelay(5)).toBe(16000);
  });

  it('returns null for attempt 6 (exceeds max retries)', () => {
    expect(getRetryDelay(6)).toBeNull();
  });

  it('returns null for attempt 0 (below valid range)', () => {
    expect(getRetryDelay(0)).toBeNull();
  });

  it('returns null for negative attempt numbers', () => {
    expect(getRetryDelay(-1)).toBeNull();
  });

  it('returns null for very large attempt numbers', () => {
    expect(getRetryDelay(100)).toBeNull();
  });
});
