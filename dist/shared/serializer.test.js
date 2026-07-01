"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const serializer_1 = require("./serializer");
const constants_1 = require("./constants");
(0, vitest_1.describe)('serializer', () => {
    (0, vitest_1.describe)('serializeRequest / deserializeRequest', () => {
        (0, vitest_1.it)('round-trips a text body request', () => {
            const method = 'POST';
            const path = '/api/users';
            const headers = { 'content-type': 'application/json' };
            const body = Buffer.from(JSON.stringify({ name: 'Alice' }));
            const msg = (0, serializer_1.serializeRequest)(method, path, headers, body);
            (0, vitest_1.expect)(msg.method).toBe(method);
            (0, vitest_1.expect)(msg.path).toBe(path);
            (0, vitest_1.expect)(msg.headers).toEqual(headers);
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(false);
            (0, vitest_1.expect)(msg.requestId).toBeTruthy();
            (0, vitest_1.expect)(msg.timestamp).toBeGreaterThan(0);
            const result = (0, serializer_1.deserializeRequest)(msg);
            (0, vitest_1.expect)(result.method).toBe(method);
            (0, vitest_1.expect)(result.path).toBe(path);
            (0, vitest_1.expect)(result.headers).toEqual(headers);
            (0, vitest_1.expect)(result.body).toEqual(body);
        });
        (0, vitest_1.it)('round-trips a binary body request', () => {
            const method = 'PUT';
            const path = '/upload';
            const headers = { 'content-type': 'application/octet-stream' };
            // Create a buffer with binary content (non-text bytes)
            const body = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x80]);
            const msg = (0, serializer_1.serializeRequest)(method, path, headers, body);
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(true);
            (0, vitest_1.expect)(msg.body).toBe(body.toString('base64'));
            const result = (0, serializer_1.deserializeRequest)(msg);
            (0, vitest_1.expect)(result.body).toEqual(body);
        });
        (0, vitest_1.it)('handles null body', () => {
            const msg = (0, serializer_1.serializeRequest)('GET', '/health', {}, null);
            (0, vitest_1.expect)(msg.body).toBeNull();
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(false);
            const result = (0, serializer_1.deserializeRequest)(msg);
            (0, vitest_1.expect)(result.body).toBeNull();
        });
        (0, vitest_1.it)('throws when body exceeds MAX_PAYLOAD_BYTES', () => {
            const largeBody = Buffer.alloc(constants_1.MAX_PAYLOAD_BYTES + 1, 'a');
            (0, vitest_1.expect)(() => (0, serializer_1.serializeRequest)('POST', '/large', {}, largeBody)).toThrow(/exceeds maximum payload size/);
        });
        (0, vitest_1.it)('generates unique request IDs', () => {
            const msg1 = (0, serializer_1.serializeRequest)('GET', '/', {}, null);
            const msg2 = (0, serializer_1.serializeRequest)('GET', '/', {}, null);
            (0, vitest_1.expect)(msg1.requestId).not.toBe(msg2.requestId);
        });
    });
    (0, vitest_1.describe)('serializeResponse / deserializeResponse', () => {
        (0, vitest_1.it)('round-trips a text body response', () => {
            const statusCode = 200;
            const headers = { 'content-type': 'application/json' };
            const body = Buffer.from('{"ok":true}');
            const requestId = 'test-req-id';
            const startTime = Date.now() - 50;
            const msg = (0, serializer_1.serializeResponse)(statusCode, headers, body, requestId, startTime);
            (0, vitest_1.expect)(msg.statusCode).toBe(statusCode);
            (0, vitest_1.expect)(msg.headers).toEqual(headers);
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(false);
            (0, vitest_1.expect)(msg.requestId).toBe(requestId);
            (0, vitest_1.expect)(msg.latencyMs).toBeGreaterThanOrEqual(0);
            const result = (0, serializer_1.deserializeResponse)(msg);
            (0, vitest_1.expect)(result.statusCode).toBe(statusCode);
            (0, vitest_1.expect)(result.headers).toEqual(headers);
            (0, vitest_1.expect)(result.body).toEqual(body);
        });
        (0, vitest_1.it)('round-trips a binary body response', () => {
            const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
            const msg = (0, serializer_1.serializeResponse)(200, {}, body, 'req-1', Date.now());
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(true);
            const result = (0, serializer_1.deserializeResponse)(msg);
            (0, vitest_1.expect)(result.body).toEqual(body);
        });
        (0, vitest_1.it)('handles null body response', () => {
            const msg = (0, serializer_1.serializeResponse)(204, {}, null, 'req-1', Date.now());
            (0, vitest_1.expect)(msg.body).toBeNull();
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(false);
            const result = (0, serializer_1.deserializeResponse)(msg);
            (0, vitest_1.expect)(result.body).toBeNull();
        });
        (0, vitest_1.it)('throws when response body exceeds MAX_PAYLOAD_BYTES', () => {
            const largeBody = Buffer.alloc(constants_1.MAX_PAYLOAD_BYTES + 1, 'b');
            (0, vitest_1.expect)(() => (0, serializer_1.serializeResponse)(200, {}, largeBody, 'req-1', Date.now())).toThrow(/exceeds maximum payload size/);
        });
    });
    (0, vitest_1.describe)('string body handling', () => {
        (0, vitest_1.it)('handles string body as text when content-type is json', () => {
            const body = '{"hello":"world"}';
            const headers = { 'content-type': 'application/json' };
            const msg = (0, serializer_1.serializeRequest)('POST', '/api', headers, body);
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(false);
            (0, vitest_1.expect)(msg.body).toBe(body);
            const result = (0, serializer_1.deserializeRequest)(msg);
            (0, vitest_1.expect)(result.body?.toString()).toBe(body);
        });
        (0, vitest_1.it)('handles string body as text for text content types', () => {
            const body = '<html><body>Hello</body></html>';
            const headers = { 'Content-Type': 'text/html' };
            const msg = (0, serializer_1.serializeRequest)('POST', '/page', headers, body);
            (0, vitest_1.expect)(msg.isBase64Encoded).toBe(false);
            (0, vitest_1.expect)(msg.body).toBe(body);
        });
    });
});
//# sourceMappingURL=serializer.test.js.map