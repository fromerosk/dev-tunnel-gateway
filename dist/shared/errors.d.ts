/**
 * Error codes and error response factory for the Dev Tunnel Gateway.
 *
 * These codes map to specific failure scenarios described in the
 * design document's error handling section.
 */
export declare enum ErrorCode {
    /** Tunnel session is inactive (disconnected) */
    TUNNEL_OFFLINE = "TUNNEL_OFFLINE",
    /** Tunnel client cannot reach the local dev server */
    LOCAL_UNREACHABLE = "LOCAL_UNREACHABLE",
    /** Request timed out waiting for tunnel response (>30s) */
    TUNNEL_TIMEOUT = "TUNNEL_TIMEOUT",
    /** Invalid or expired authentication token */
    AUTH_FAILED = "AUTH_FAILED",
    /** Session token expired on reconnection attempt */
    SESSION_EXPIRED = "SESSION_EXPIRED",
    /** Gateway cannot accept new connections */
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
}
export interface ErrorResponse {
    error: {
        code: ErrorCode;
        message: string;
    };
}
/**
 * Creates a structured error response body.
 *
 * @param code - The error code identifying the failure scenario
 * @param message - Optional custom message; falls back to the default for the code
 */
export declare function createErrorResponse(code: ErrorCode, message?: string): ErrorResponse;
//# sourceMappingURL=errors.d.ts.map