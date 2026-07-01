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
export function formatRequestLog(
  method: string,
  path: string,
  statusCode: number,
  latencyMs: number
): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${hours}:${minutes}:${seconds}`;

  return `[${timestamp}] ${method} ${path} -> ${statusCode} (${latencyMs} ms)`;
}

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
export function parseRequestLog(logLine: string): ParsedRequestLog | null {
  // Match: [HH:MM:SS] METHOD /path -> STATUS (latencyMs ms)
  const regex = /^\[\d{2}:\d{2}:\d{2}\] (\S+) (.+) -> (\d+) \((\d+) ms\)$/;
  const match = logLine.match(regex);

  if (!match) {
    return null;
  }

  return {
    method: match[1],
    path: match[2],
    statusCode: parseInt(match[3], 10),
    latencyMs: parseInt(match[4], 10),
  };
}
