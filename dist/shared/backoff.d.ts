/**
 * Calculates the retry delay using exponential backoff.
 *
 * Returns `2^(attempt-1) * 1000` milliseconds for attempts 1 through MAX_RETRIES,
 * or `null` if the attempt exceeds MAX_RETRIES or is less than 1 (no more retries).
 *
 * @param attempt - 1-based attempt index (first attempt = 1)
 * @returns Delay in milliseconds, or null if retries are exhausted
 */
export declare function getRetryDelay(attempt: number): number | null;
//# sourceMappingURL=backoff.d.ts.map