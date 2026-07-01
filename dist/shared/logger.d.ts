/**
 * Request log formatter for the Dev Tunnel Gateway.
 *
 * Formats request logs to stdout showing method, path, status code, and latency.
 * Also provides a parser for test validation of log completeness.
 */
/**
 * Formats a request log entry with the current timestamp.
 *
 * Output format: `[HH:MM:SS] METHOD /path -> STATUS (latencyMs ms)`
 *
 * @param method - HTTP method (e.g., GET, POST)
 * @param path - Request path (e.g., /api/users)
 * @param statusCode - HTTP response status code
 * @param latencyMs - Response time in milliseconds
 * @returns Formatted log string
 */
export declare function formatRequestLog(method: string, path: string, statusCode: number, latencyMs: number): string;
/**
 * Parsed components of a request log line.
 */
export interface ParsedRequestLog {
    method: string;
    path: string;
    statusCode: number;
    latencyMs: number;
}
/**
 * Parses a formatted request log line back into its components.
 * The timestamp is not returned since it varies.
 *
 * @param logLine - A log line produced by `formatRequestLog`
 * @returns Parsed log components, or null if parsing fails
 */
export declare function parseRequestLog(logLine: string): ParsedRequestLog | null;
//# sourceMappingURL=logger.d.ts.map