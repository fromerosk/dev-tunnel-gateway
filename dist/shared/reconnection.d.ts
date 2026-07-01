export interface ReconnectionSuccess {
    canReconnect: true;
}
export interface ReconnectionFailure {
    canReconnect: false;
    reason: 'token_mismatch' | 'window_expired';
}
export type ReconnectionResult = ReconnectionSuccess | ReconnectionFailure;
/**
 * Validates whether a disconnected session can be reconnected.
 *
 * Reconnection succeeds if and only if:
 * 1. The provided session token matches the stored token
 * 2. The current time is within the 5-minute reconnection window since disconnection
 *
 * @param sessionToken - Token the client provides for reconnection
 * @param storedSessionToken - Token stored in the database for the session
 * @param disconnectedAt - Epoch milliseconds when the session was disconnected
 * @param now - Current epoch milliseconds
 */
export declare function validateReconnection(sessionToken: string, storedSessionToken: string, disconnectedAt: number, now: number): ReconnectionResult;
//# sourceMappingURL=reconnection.d.ts.map