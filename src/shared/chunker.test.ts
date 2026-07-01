import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chunkMessage, reassembleChunks, ChunkBuffer } from './chunker';
import { CHUNK_SIZE_BYTES, MAX_FRAME_BYTES, REQUEST_TIMEOUT_MS } from './constants';

describe('chunkMessage', () => {
  it('returns a single CompleteMessage for payloads <= 32KB', () => {
    const payload = 'a'.repeat(MAX_FRAME_BYTES);
    const chunks = chunkMessage(payload, 'request');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].payload).toBe(payload);
    expect(chunks[0].type).toBe('request');
    expect(chunks[0].messageId).toBeDefined();
  });

  it('splits payloads > 32KB into chunks of <= 28KB', () => {
    const payload = 'b'.repeat(MAX_FRAME_BYTES + 1);
    const chunks = chunkMessage(payload, 'response');

    expect(chunks.length).toBe(Math.ceil(payload.length / CHUNK_SIZE_BYTES));
    for (const chunk of chunks) {
      expect(chunk.payload.length).toBeLessThanOrEqual(CHUNK_SIZE_BYTES);
      expect(chunk.type).toBe('response');
    }
  });

  it('assigns the same messageId to all chunks', () => {
    const payload = 'c'.repeat(100_000);
    const chunks = chunkMessage(payload, 'request');

    const messageId = chunks[0].messageId;
    for (const chunk of chunks) {
      expect(chunk.messageId).toBe(messageId);
    }
  });

  it('sets correct chunkIndex and totalChunks for each chunk', () => {
    const payload = 'd'.repeat(CHUNK_SIZE_BYTES * 3 + 100);
    const chunks = chunkMessage(payload, 'request');

    expect(chunks).toHaveLength(4);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].totalChunks).toBe(4);
    }
  });

  it('handles empty payload as a single message', () => {
    const chunks = chunkMessage('', 'request');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].payload).toBe('');
    expect(chunks[0].totalChunks).toBe(1);
  });
});

describe('reassembleChunks', () => {
  it('reassembles chunks into the original payload', () => {
    const original = 'e'.repeat(100_000);
    const chunks = chunkMessage(original, 'request');
    const reassembled = reassembleChunks(chunks);

    expect(reassembled).toBe(original);
  });

  it('handles out-of-order chunks correctly', () => {
    const original = 'Hello World! '.repeat(5000);
    const chunks = chunkMessage(original, 'response');
    const reversed = [...chunks].reverse();
    const reassembled = reassembleChunks(reversed);

    expect(reassembled).toBe(original);
  });

  it('handles a single-chunk message', () => {
    const original = 'small payload';
    const chunks = chunkMessage(original, 'request');
    const reassembled = reassembleChunks(chunks);

    expect(reassembled).toBe(original);
  });
});

describe('ChunkBuffer', () => {
  let buffer: ChunkBuffer;

  beforeEach(() => {
    buffer = new ChunkBuffer();
  });

  it('returns null when not all chunks have arrived', () => {
    const payload = 'f'.repeat(100_000);
    const chunks = chunkMessage(payload, 'request');

    // Send all but the last chunk
    for (let i = 0; i < chunks.length - 1; i++) {
      const result = buffer.addChunk(chunks[i]);
      expect(result).toBeNull();
    }
  });

  it('returns the reassembled payload when all chunks arrive', () => {
    const payload = 'g'.repeat(100_000);
    const chunks = chunkMessage(payload, 'request');

    let result: string | null = null;
    for (const chunk of chunks) {
      result = buffer.addChunk(chunk);
    }

    expect(result).toBe(payload);
  });

  it('handles chunks arriving out of order', () => {
    const payload = 'h'.repeat(100_000);
    const chunks = chunkMessage(payload, 'response');
    const shuffled = [...chunks].sort(() => Math.random() - 0.5);

    let result: string | null = null;
    for (const chunk of shuffled) {
      result = buffer.addChunk(chunk);
    }

    expect(result).toBe(payload);
  });

  it('handles single-chunk (complete) messages immediately', () => {
    const payload = 'small message';
    const chunks = chunkMessage(payload, 'request');

    const result = buffer.addChunk(chunks[0]);
    expect(result).toBe(payload);
  });

  it('ignores duplicate chunks (idempotent by chunkIndex)', () => {
    const payload = 'i'.repeat(100_000);
    const chunks = chunkMessage(payload, 'request');

    // Send first chunk twice
    buffer.addChunk(chunks[0]);
    buffer.addChunk(chunks[0]);

    // Send remaining chunks
    let result: string | null = null;
    for (let i = 1; i < chunks.length; i++) {
      result = buffer.addChunk(chunks[i]);
    }

    expect(result).toBe(payload);
  });

  it('tracks multiple messages independently', () => {
    const payload1 = 'j'.repeat(100_000);
    const payload2 = 'k'.repeat(80_000);
    const chunks1 = chunkMessage(payload1, 'request');
    const chunks2 = chunkMessage(payload2, 'response');

    // Interleave chunks from both messages
    for (let i = 0; i < chunks1.length - 1; i++) {
      buffer.addChunk(chunks1[i]);
    }
    for (let i = 0; i < chunks2.length - 1; i++) {
      buffer.addChunk(chunks2[i]);
    }

    // Complete message 2 first
    const result2 = buffer.addChunk(chunks2[chunks2.length - 1]);
    expect(result2).toBe(payload2);

    // Complete message 1
    const result1 = buffer.addChunk(chunks1[chunks1.length - 1]);
    expect(result1).toBe(payload1);
  });

  describe('hasTimedOut', () => {
    it('returns false for unknown messageId', () => {
      expect(buffer.hasTimedOut('nonexistent')).toBe(false);
    });

    it('returns false when message is within timeout window', () => {
      const chunks = chunkMessage('l'.repeat(100_000), 'request');
      buffer.addChunk(chunks[0]);

      const now = Date.now() + REQUEST_TIMEOUT_MS - 1;
      expect(buffer.hasTimedOut(chunks[0].messageId, now)).toBe(false);
    });

    it('returns true when message has exceeded timeout', () => {
      const chunks = chunkMessage('m'.repeat(100_000), 'request');
      buffer.addChunk(chunks[0]);

      const now = Date.now() + REQUEST_TIMEOUT_MS;
      expect(buffer.hasTimedOut(chunks[0].messageId, now)).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('removes timed-out messages from the buffer', () => {
      const chunks = chunkMessage('n'.repeat(100_000), 'request');
      buffer.addChunk(chunks[0]);

      const now = Date.now() + REQUEST_TIMEOUT_MS + 1;
      buffer.cleanup(now);

      // After cleanup, adding the remaining chunks should not reassemble
      // (the first chunk's entry was removed)
      let result: string | null = null;
      for (let i = 1; i < chunks.length; i++) {
        result = buffer.addChunk(chunks[i]);
      }
      // It won't complete because chunk 0 is missing from the new entry
      expect(result).toBeNull();
    });

    it('does not remove messages within the timeout window', () => {
      const payload = 'o'.repeat(100_000);
      const chunks = chunkMessage(payload, 'request');
      buffer.addChunk(chunks[0]);

      const now = Date.now() + REQUEST_TIMEOUT_MS - 1000;
      buffer.cleanup(now);

      // Message entry should still be intact, so adding remaining chunks works
      let result: string | null = null;
      for (let i = 1; i < chunks.length; i++) {
        result = buffer.addChunk(chunks[i]);
      }
      expect(result).toBe(payload);
    });
  });
});
