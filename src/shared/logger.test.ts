import { describe, it, expect } from 'vitest';
import { formatRequestLog, parseRequestLog } from './logger';

describe('formatRequestLog', () => {
  it('formats a GET request log entry', () => {
    const log = formatRequestLog('GET', '/api/users', 200, 45);

    // Should match pattern: [HH:MM:SS] GET /api/users -> 200 (45 ms)
    expect(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] GET \/api\/users -> 200 \(45 ms\)$/);
  });

  it('formats a POST request with high latency', () => {
    const log = formatRequestLog('POST', '/api/data', 201, 1500);

    expect(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] POST \/api\/data -> 201 \(1500 ms\)$/);
  });

  it('formats a 500 error response', () => {
    const log = formatRequestLog('DELETE', '/api/items/42', 500, 12);

    expect(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] DELETE \/api\/items\/42 -> 500 \(12 ms\)$/);
  });

  it('handles zero latency', () => {
    const log = formatRequestLog('GET', '/', 204, 0);

    expect(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] GET \/ -> 204 \(0 ms\)$/);
  });

  it('includes all four fields in the output', () => {
    const log = formatRequestLog('PUT', '/resource', 200, 99);

    expect(log).toContain('PUT');
    expect(log).toContain('/resource');
    expect(log).toContain('200');
    expect(log).toContain('99 ms');
  });
});

describe('parseRequestLog', () => {
  it('parses a valid log line back to components', () => {
    const log = formatRequestLog('GET', '/api/users', 200, 45);
    const parsed = parseRequestLog(log);

    expect(parsed).not.toBeNull();
    expect(parsed!.method).toBe('GET');
    expect(parsed!.path).toBe('/api/users');
    expect(parsed!.statusCode).toBe(200);
    expect(parsed!.latencyMs).toBe(45);
  });

  it('parses a POST request log', () => {
    const log = formatRequestLog('POST', '/api/items', 201, 320);
    const parsed = parseRequestLog(log);

    expect(parsed).not.toBeNull();
    expect(parsed!.method).toBe('POST');
    expect(parsed!.path).toBe('/api/items');
    expect(parsed!.statusCode).toBe(201);
    expect(parsed!.latencyMs).toBe(320);
  });

  it('returns null for invalid log lines', () => {
    expect(parseRequestLog('')).toBeNull();
    expect(parseRequestLog('not a log')).toBeNull();
    expect(parseRequestLog('[invalid] GET /')).toBeNull();
  });

  it('returns null for partial log lines', () => {
    expect(parseRequestLog('[12:00:00] GET /path')).toBeNull();
    expect(parseRequestLog('[12:00:00] GET /path -> 200')).toBeNull();
  });

  it('round-trips a log entry correctly', () => {
    const method = 'PATCH';
    const path = '/api/v2/widgets/123';
    const statusCode = 204;
    const latencyMs = 88;

    const log = formatRequestLog(method, path, statusCode, latencyMs);
    const parsed = parseRequestLog(log);

    expect(parsed).toEqual({ method, path, statusCode, latencyMs });
  });

  it('handles paths with special characters', () => {
    const log = formatRequestLog('GET', '/api/users?name=test&page=1', 200, 10);
    const parsed = parseRequestLog(log);

    expect(parsed).not.toBeNull();
    expect(parsed!.path).toBe('/api/users?name=test&page=1');
  });
});
