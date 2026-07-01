"use strict";
/**
 * Error codes and error response factory for the Dev Tunnel Gateway.
 *
 * These codes map to specific failure scenarios described in the
 * design document's error handling section.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
exports.createErrorResponse = createErrorResponse;
var ErrorCode;
(function (ErrorCode) {
    /** Tunnel session is inactive (disconnected) */
    ErrorCode["TUNNEL_OFFLINE"] = "TUNNEL_OFFLINE";
    /** Tunnel client cannot reach the local dev server */
    ErrorCode["LOCAL_UNREACHABLE"] = "LOCAL_UNREACHABLE";
    /** Request timed out waiting for tunnel response (>30s) */
    ErrorCode["TUNNEL_TIMEOUT"] = "TUNNEL_TIMEOUT";
    /** Invalid or expired authentication token */
    ErrorCode["AUTH_FAILED"] = "AUTH_FAILED";
    /** Session token expired on reconnection attempt */
    ErrorCode["SESSION_EXPIRED"] = "SESSION_EXPIRED";
    /** Gateway cannot accept new connections */
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/** Default human-readable messages for each error code */
const ERROR_MESSAGES = {
    [ErrorCode.TUNNEL_OFFLINE]: 'Tunnel is currently offline',
    [ErrorCode.LOCAL_UNREACHABLE]: 'Local development server is not reachable on configured port',
    [ErrorCode.TUNNEL_TIMEOUT]: 'Request timed out waiting for response from tunnel',
    [ErrorCode.AUTH_FAILED]: 'Authentication failed',
    [ErrorCode.SESSION_EXPIRED]: 'Session token has expired, please establish a new session',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'Gateway cannot accept new connections',
};
/**
 * Creates a structured error response body.
 *
 * @param code - The error code identifying the failure scenario
 * @param message - Optional custom message; falls back to the default for the code
 */
function createErrorResponse(code, message) {
    return {
        error: {
            code,
            message: message ?? ERROR_MESSAGES[code],
        },
    };
}
//# sourceMappingURL=errors.js.map