"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const backoff_1 = require("./backoff");
(0, vitest_1.describe)('getRetryDelay', () => {
    (0, vitest_1.it)('returns 1000ms for attempt 1', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(1)).toBe(1000);
    });
    (0, vitest_1.it)('returns 2000ms for attempt 2', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(2)).toBe(2000);
    });
    (0, vitest_1.it)('returns 4000ms for attempt 3', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(3)).toBe(4000);
    });
    (0, vitest_1.it)('returns 8000ms for attempt 4', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(4)).toBe(8000);
    });
    (0, vitest_1.it)('returns 16000ms for attempt 5', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(5)).toBe(16000);
    });
    (0, vitest_1.it)('returns null for attempt 6 (exceeds max retries)', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(6)).toBeNull();
    });
    (0, vitest_1.it)('returns null for attempt 0 (below valid range)', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(0)).toBeNull();
    });
    (0, vitest_1.it)('returns null for negative attempt numbers', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(-1)).toBeNull();
    });
    (0, vitest_1.it)('returns null for very large attempt numbers', () => {
        (0, vitest_1.expect)((0, backoff_1.getRetryDelay)(100)).toBeNull();
    });
});
//# sourceMappingURL=backoff.test.js.map