import { describe, it, expect } from 'vitest';
import {
  serializeRequest,
  deserializeRequest,
  serializeResponse,
  deserializeResponse,
} from './serializer';
import { MAX_PAYLOAD_BYTES } from './constants';

describe('serializer', () => {
  describe('serializeRequest / deserializeRequest', () => {
    it('round-trips a text body request', () => {
      const method = 'POST';
      const path = '/api/users';
      const headers = { 'content-type': 'application/json' };
      const body = Buffer.from(JSON.stringify({ name: 'Alice' }));

      const msg = serializeRequest(method, path, headers, body);

      expect(msg.method).toBe(method);
      expect(msg.path).toBe(path);
      expect(msg.headers).toEqual(headers);
      expect(msg.isBase64Encoded).toBe(false);
      expect(msg.requestId).toBeTruthy();
      expect(msg.timestamp).toBeGreaterThan(0);

      const result = deserializeRequest(msg);
      expect(result.method).toBe(method);
      expect(result.path).toBe(path);
      expect(result.headers).toEqual(headers);
      expect(result.body).toEqual(body);
    });

    it('round-trips a binary body request', () => {
      const method = 'PUT';
      const path = '/upload';
      const headers = { 'content-type': 'application/octet-stream' };
      // Create a buffer with binary content (non-text bytes)
      const body = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x80]);

      const msg = serializeRequest(method, path, headers, body);

      expect(msg.isBase64Encoded).toBe(true);
      expect(msg.body).toBe(body.toString('base64'));

      const result = deserializeRequest(msg);
      expect(result.body).toEqual(body);
    });

    it('handles null body', () => {
      const msg = serializeRequest('GET', '/health', {}, null);

      expect(msg.body).toBeNull();
      expect(msg.isBase64Encoded).toBe(false);

      const result = deserializeRequest(msg);
      expect(result.body).toBeNull();
    });

    it('throws when body exceeds MAX_PAYLOAD_BYTES', () => {
      const largeBody = Buffer.alloc(MAX_PAYLOAD_BYTES + 1, 'a');
      expect(() =>
        serializeRequest('POST', '/large', {}, largeBody)
      ).toThrow(/exceeds maximum payload size/);
    });

    it('generates unique request IDs', () => {
      const msg1 = serializeRequest('GET', '/', {}, null);
      const msg2 = serializeRequest('GET', '/', {}, null);
      expect(msg1.requestId).not.toBe(msg2.requestId);
    });
  });

  describe('serializeResponse / deserializeResponse', () => {
    it('round-trips a text body response', () => {
      const statusCode = 200;
      const headers = { 'content-type': 'application/json' };
      const body = Buffer.from('{"ok":true}');
      const requestId = 'test-req-id';
      const startTime = Date.now() - 50;

      const msg = serializeResponse(statusCode, headers, body, requestId, startTime);

      expect(msg.statusCode).toBe(statusCode);
      expect(msg.headers).toEqual(headers);
      expect(msg.isBase64Encoded).toBe(false);
      expect(msg.requestId).toBe(requestId);
      expect(msg.latencyMs).toBeGreaterThanOrEqual(0);

      const result = deserializeResponse(msg);
      expect(result.statusCode).toBe(statusCode);
      expect(result.headers).toEqual(headers);
      expect(result.body).toEqual(body);
    });

    it('round-trips a binary body response', () => {
      const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
      const msg = serializeResponse(200, {}, body, 'req-1', Date.now());

      expect(msg.isBase64Encoded).toBe(true);

      const result = deserializeResponse(msg);
      expect(result.body).toEqual(body);
    });

    it('handles null body response', () => {
      const msg = serializeResponse(204, {}, null, 'req-1', Date.now());

      expect(msg.body).toBeNull();
      expect(msg.isBase64Encoded).toBe(false);

      const result = deserializeResponse(msg);
      expect(result.body).toBeNull();
    });

    it('throws when response body exceeds MAX_PAYLOAD_BYTES', () => {
      const largeBody = Buffer.alloc(MAX_PAYLOAD_BYTES + 1, 'b');
      expect(() =>
        serializeResponse(200, {}, largeBody, 'req-1', Date.now())
      ).toThrow(/exceeds maximum payload size/);
    });
  });

  describe('string body handling', () => {
    it('handles string body as text when content-type is json', () => {
      const body = '{"hello":"world"}';
      const headers = { 'content-type': 'application/json' };
      const msg = serializeRequest('POST', '/api', headers, body);

      expect(msg.isBase64Encoded).toBe(false);
      expect(msg.body).toBe(body);

      const result = deserializeRequest(msg);
      expect(result.body?.toString()).toBe(body);
    });

    it('handles string body as text for text content types', () => {
      const body = '<html><body>Hello</body></html>';
      const headers = { 'Content-Type': 'text/html' };
      const msg = serializeRequest('POST', '/page', headers, body);

      expect(msg.isBase64Encoded).toBe(false);
      expect(msg.body).toBe(body);
    });
  });
});
