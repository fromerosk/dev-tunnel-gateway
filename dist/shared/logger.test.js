"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const logger_1 = require("./logger");
(0, vitest_1.describe)('formatRequestLog', () => {
    (0, vitest_1.it)('formats a GET request log entry', () => {
        const log = (0, logger_1.formatRequestLog)('GET', '/api/users', 200, 45);
        // Should match pattern: [HH:MM:SS] GET /api/users -> 200 (45 ms)
        (0, vitest_1.expect)(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] GET \/api\/users -> 200 \(45 ms\)$/);
    });
    (0, vitest_1.it)('formats a POST request with high latency', () => {
        const log = (0, logger_1.formatRequestLog)('POST', '/api/data', 201, 1500);
        (0, vitest_1.expect)(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] POST \/api\/data -> 201 \(1500 ms\)$/);
    });
    (0, vitest_1.it)('formats a 500 error response', () => {
        const log = (0, logger_1.formatRequestLog)('DELETE', '/api/items/42', 500, 12);
        (0, vitest_1.expect)(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] DELETE \/api\/items\/42 -> 500 \(12 ms\)$/);
    });
    (0, vitest_1.it)('handles zero latency', () => {
        const log = (0, logger_1.formatRequestLog)('GET', '/', 204, 0);
        (0, vitest_1.expect)(log).toMatch(/^\[\d{2}:\d{2}:\d{2}\] GET \/ -> 204 \(0 ms\)$/);
    });
    (0, vitest_1.it)('includes all four fields in the output', () => {
        const log = (0, logger_1.formatRequestLog)('PUT', '/resource', 200, 99);
        (0, vitest_1.expect)(log).toContain('PUT');
        (0, vitest_1.expect)(log).toContain('/resource');
        (0, vitest_1.expect)(log).toContain('200');
        (0, vitest_1.expect)(log).toContain('99 ms');
    });
});
(0, vitest_1.describe)('parseRequestLog', () => {
    (0, vitest_1.it)('parses a valid log line back to components', () => {
        const log = (0, logger_1.formatRequestLog)('GET', '/api/users', 200, 45);
        const parsed = (0, logger_1.parseRequestLog)(log);
        (0, vitest_1.expect)(parsed).not.toBeNull();
        (0, vitest_1.expect)(parsed.method).toBe('GET');
        (0, vitest_1.expect)(parsed.path).toBe('/api/users');
        (0, vitest_1.expect)(parsed.statusCode).toBe(200);
        (0, vitest_1.expect)(parsed.latencyMs).toBe(45);
    });
    (0, vitest_1.it)('parses a POST request log', () => {
        const log = (0, logger_1.formatRequestLog)('POST', '/api/items', 201, 320);
        const parsed = (0, logger_1.parseRequestLog)(log);
        (0, vitest_1.expect)(parsed).not.toBeNull();
        (0, vitest_1.expect)(parsed.method).toBe('POST');
        (0, vitest_1.expect)(parsed.path).toBe('/api/items');
        (0, vitest_1.expect)(parsed.statusCode).toBe(201);
        (0, vitest_1.expect)(parsed.latencyMs).toBe(320);
    });
    (0, vitest_1.it)('returns null for invalid log lines', () => {
        (0, vitest_1.expect)((0, logger_1.parseRequestLog)('')).toBeNull();
        (0, vitest_1.expect)((0, logger_1.parseRequestLog)('not a log')).toBeNull();
        (0, vitest_1.expect)((0, logger_1.parseRequestLog)('[invalid] GET /')).toBeNull();
    });
    (0, vitest_1.it)('returns null for partial log lines', () => {
        (0, vitest_1.expect)((0, logger_1.parseRequestLog)('[12:00:00] GET /path')).toBeNull();
        (0, vitest_1.expect)((0, logger_1.parseRequestLog)('[12:00:00] GET /path -> 200')).toBeNull();
    });
    (0, vitest_1.it)('round-trips a log entry correctly', () => {
        const method = 'PATCH';
        const path = '/api/v2/widgets/123';
        const statusCode = 204;
        const latencyMs = 88;
        const log = (0, logger_1.formatRequestLog)(method, path, statusCode, latencyMs);
        const parsed = (0, logger_1.parseRequestLog)(log);
        (0, vitest_1.expect)(parsed).toEqual({ method, path, statusCode, latencyMs });
    });
    (0, vitest_1.it)('handles paths with special characters', () => {
        const log = (0, logger_1.formatRequestLog)('GET', '/api/users?name=test&page=1', 200, 10);
        const parsed = (0, logger_1.parseRequestLog)(log);
        (0, vitest_1.expect)(parsed).not.toBeNull();
        (0, vitest_1.expect)(parsed.path).toBe('/api/users?name=test&page=1');
    });
});
//# sourceMappingURL=logger.test.js.map