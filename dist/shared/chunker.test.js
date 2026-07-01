"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const chunker_1 = require("./chunker");
const constants_1 = require("./constants");
(0, vitest_1.describe)('chunkMessage', () => {
    (0, vitest_1.it)('returns a single CompleteMessage for payloads <= 32KB', () => {
        const payload = 'a'.repeat(constants_1.MAX_FRAME_BYTES);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
        (0, vitest_1.expect)(chunks).toHaveLength(1);
        (0, vitest_1.expect)(chunks[0].chunkIndex).toBe(0);
        (0, vitest_1.expect)(chunks[0].totalChunks).toBe(1);
        (0, vitest_1.expect)(chunks[0].payload).toBe(payload);
        (0, vitest_1.expect)(chunks[0].type).toBe('request');
        (0, vitest_1.expect)(chunks[0].messageId).toBeDefined();
    });
    (0, vitest_1.it)('splits payloads > 32KB into chunks of <= 28KB', () => {
        const payload = 'b'.repeat(constants_1.MAX_FRAME_BYTES + 1);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'response');
        (0, vitest_1.expect)(chunks.length).toBe(Math.ceil(payload.length / constants_1.CHUNK_SIZE_BYTES));
        for (const chunk of chunks) {
            (0, vitest_1.expect)(chunk.payload.length).toBeLessThanOrEqual(constants_1.CHUNK_SIZE_BYTES);
            (0, vitest_1.expect)(chunk.type).toBe('response');
        }
    });
    (0, vitest_1.it)('assigns the same messageId to all chunks', () => {
        const payload = 'c'.repeat(100_000);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
        const messageId = chunks[0].messageId;
        for (const chunk of chunks) {
            (0, vitest_1.expect)(chunk.messageId).toBe(messageId);
        }
    });
    (0, vitest_1.it)('sets correct chunkIndex and totalChunks for each chunk', () => {
        const payload = 'd'.repeat(constants_1.CHUNK_SIZE_BYTES * 3 + 100);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
        (0, vitest_1.expect)(chunks).toHaveLength(4);
        for (let i = 0; i < chunks.length; i++) {
            (0, vitest_1.expect)(chunks[i].chunkIndex).toBe(i);
            (0, vitest_1.expect)(chunks[i].totalChunks).toBe(4);
        }
    });
    (0, vitest_1.it)('handles empty payload as a single message', () => {
        const chunks = (0, chunker_1.chunkMessage)('', 'request');
        (0, vitest_1.expect)(chunks).toHaveLength(1);
        (0, vitest_1.expect)(chunks[0].payload).toBe('');
        (0, vitest_1.expect)(chunks[0].totalChunks).toBe(1);
    });
});
(0, vitest_1.describe)('reassembleChunks', () => {
    (0, vitest_1.it)('reassembles chunks into the original payload', () => {
        const original = 'e'.repeat(100_000);
        const chunks = (0, chunker_1.chunkMessage)(original, 'request');
        const reassembled = (0, chunker_1.reassembleChunks)(chunks);
        (0, vitest_1.expect)(reassembled).toBe(original);
    });
    (0, vitest_1.it)('handles out-of-order chunks correctly', () => {
        const original = 'Hello World! '.repeat(5000);
        const chunks = (0, chunker_1.chunkMessage)(original, 'response');
        const reversed = [...chunks].reverse();
        const reassembled = (0, chunker_1.reassembleChunks)(reversed);
        (0, vitest_1.expect)(reassembled).toBe(original);
    });
    (0, vitest_1.it)('handles a single-chunk message', () => {
        const original = 'small payload';
        const chunks = (0, chunker_1.chunkMessage)(original, 'request');
        const reassembled = (0, chunker_1.reassembleChunks)(chunks);
        (0, vitest_1.expect)(reassembled).toBe(original);
    });
});
(0, vitest_1.describe)('ChunkBuffer', () => {
    let buffer;
    (0, vitest_1.beforeEach)(() => {
        buffer = new chunker_1.ChunkBuffer();
    });
    (0, vitest_1.it)('returns null when not all chunks have arrived', () => {
        const payload = 'f'.repeat(100_000);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
        // Send all but the last chunk
        for (let i = 0; i < chunks.length - 1; i++) {
            const result = buffer.addChunk(chunks[i]);
            (0, vitest_1.expect)(result).toBeNull();
        }
    });
    (0, vitest_1.it)('returns the reassembled payload when all chunks arrive', () => {
        const payload = 'g'.repeat(100_000);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
        let result = null;
        for (const chunk of chunks) {
            result = buffer.addChunk(chunk);
        }
        (0, vitest_1.expect)(result).toBe(payload);
    });
    (0, vitest_1.it)('handles chunks arriving out of order', () => {
        const payload = 'h'.repeat(100_000);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'response');
        const shuffled = [...chunks].sort(() => Math.random() - 0.5);
        let result = null;
        for (const chunk of shuffled) {
            result = buffer.addChunk(chunk);
        }
        (0, vitest_1.expect)(result).toBe(payload);
    });
    (0, vitest_1.it)('handles single-chunk (complete) messages immediately', () => {
        const payload = 'small message';
        const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
        const result = buffer.addChunk(chunks[0]);
        (0, vitest_1.expect)(result).toBe(payload);
    });
    (0, vitest_1.it)('ignores duplicate chunks (idempotent by chunkIndex)', () => {
        const payload = 'i'.repeat(100_000);
        const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
        // Send first chunk twice
        buffer.addChunk(chunks[0]);
        buffer.addChunk(chunks[0]);
        // Send remaining chunks
        let result = null;
        for (let i = 1; i < chunks.length; i++) {
            result = buffer.addChunk(chunks[i]);
        }
        (0, vitest_1.expect)(result).toBe(payload);
    });
    (0, vitest_1.it)('tracks multiple messages independently', () => {
        const payload1 = 'j'.repeat(100_000);
        const payload2 = 'k'.repeat(80_000);
        const chunks1 = (0, chunker_1.chunkMessage)(payload1, 'request');
        const chunks2 = (0, chunker_1.chunkMessage)(payload2, 'response');
        // Interleave chunks from both messages
        for (let i = 0; i < chunks1.length - 1; i++) {
            buffer.addChunk(chunks1[i]);
        }
        for (let i = 0; i < chunks2.length - 1; i++) {
            buffer.addChunk(chunks2[i]);
        }
        // Complete message 2 first
        const result2 = buffer.addChunk(chunks2[chunks2.length - 1]);
        (0, vitest_1.expect)(result2).toBe(payload2);
        // Complete message 1
        const result1 = buffer.addChunk(chunks1[chunks1.length - 1]);
        (0, vitest_1.expect)(result1).toBe(payload1);
    });
    (0, vitest_1.describe)('hasTimedOut', () => {
        (0, vitest_1.it)('returns false for unknown messageId', () => {
            (0, vitest_1.expect)(buffer.hasTimedOut('nonexistent')).toBe(false);
        });
        (0, vitest_1.it)('returns false when message is within timeout window', () => {
            const chunks = (0, chunker_1.chunkMessage)('l'.repeat(100_000), 'request');
            buffer.addChunk(chunks[0]);
            const now = Date.now() + constants_1.REQUEST_TIMEOUT_MS - 1;
            (0, vitest_1.expect)(buffer.hasTimedOut(chunks[0].messageId, now)).toBe(false);
        });
        (0, vitest_1.it)('returns true when message has exceeded timeout', () => {
            const chunks = (0, chunker_1.chunkMessage)('m'.repeat(100_000), 'request');
            buffer.addChunk(chunks[0]);
            const now = Date.now() + constants_1.REQUEST_TIMEOUT_MS;
            (0, vitest_1.expect)(buffer.hasTimedOut(chunks[0].messageId, now)).toBe(true);
        });
    });
    (0, vitest_1.describe)('cleanup', () => {
        (0, vitest_1.it)('removes timed-out messages from the buffer', () => {
            const chunks = (0, chunker_1.chunkMessage)('n'.repeat(100_000), 'request');
            buffer.addChunk(chunks[0]);
            const now = Date.now() + constants_1.REQUEST_TIMEOUT_MS + 1;
            buffer.cleanup(now);
            // After cleanup, adding the remaining chunks should not reassemble
            // (the first chunk's entry was removed)
            let result = null;
            for (let i = 1; i < chunks.length; i++) {
                result = buffer.addChunk(chunks[i]);
            }
            // It won't complete because chunk 0 is missing from the new entry
            (0, vitest_1.expect)(result).toBeNull();
        });
        (0, vitest_1.it)('does not remove messages within the timeout window', () => {
            const payload = 'o'.repeat(100_000);
            const chunks = (0, chunker_1.chunkMessage)(payload, 'request');
            buffer.addChunk(chunks[0]);
            const now = Date.now() + constants_1.REQUEST_TIMEOUT_MS - 1000;
            buffer.cleanup(now);
            // Message entry should still be intact, so adding remaining chunks works
            let result = null;
            for (let i = 1; i < chunks.length; i++) {
                result = buffer.addChunk(chunks[i]);
            }
            (0, vitest_1.expect)(result).toBe(payload);
        });
    });
});
//# sourceMappingURL=chunker.test.js.map