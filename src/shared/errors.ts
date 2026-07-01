/**
 * Error codes and error response factory for the Dev Tunnel Gateway.
 *
 * These codes map to specific failure scenarios described in the
 * design document's error handling section.
 */

export enum ErrorCode {
  /** Tunnel session is inactive (disconnected) */
  TUNNEL_OFFLINE = 'TUNNEL_OFFLINE',
  /** Tunnel client cannot reach the local dev server */
  LOCAL_UNREACHABLE = 'LOCAL_UNREACHABLE',
  /** Request timed out waiting for tunnel response (>30s) */
  TUNNEL_TIMEOUT = 'TUNNEL_TIMEOUT',
  /** Invalid or expired authentication token */
  AUTH_FAILED = 'AUTH_FAILED',
  /** Session token expired on reconnection attempt */
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  /** Gateway cannot accept new connections */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/** Default human-readable messages for each error code */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.TUNNEL_OFFLINE]: 'Tunnel is currently offline',
  [ErrorCode.LOCAL_UNREACHABLE]:
    'Local development server is not reachable on configured port',
  [ErrorCode.TUNNEL_TIMEOUT]:
    'Request timed out waiting for response from tunnel',
  [ErrorCode.AUTH_FAILED]: 'Authentication failed',
  [ErrorCode.SESSION_EXPIRED]:
    'Session token has expired, please establish a new session',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Gateway cannot accept new connections',
};

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
export function createErrorResponse(
  code: ErrorCode,
  message?: string
): ErrorResponse {
  return {
    error: {
      code,
      message: message ?? ERROR_MESSAGES[code],
    },
  };
}
