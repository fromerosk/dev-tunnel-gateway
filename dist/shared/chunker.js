"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkBuffer = void 0;
exports.chunkMessage = chunkMessage;
exports.reassembleChunks = reassembleChunks;
const uuid_1 = require("uuid");
const constants_1 = require("./constants");
/**
 * Splits a payload into one or more ChunkedMessage frames.
 *
 * - If the payload fits within MAX_FRAME_BYTES (32KB), it is sent as a single
 *   CompleteMessage (totalChunks = 1).
 * - Otherwise, the payload is split into chunks of at most CHUNK_SIZE_BYTES (28KB),
 *   leaving room for envelope metadata in each WebSocket frame.
 */
function chunkMessage(payload, type) {
    const messageId = (0, uuid_1.v4)();
    if (payload.length <= constants_1.MAX_FRAME_BYTES) {
        return [
            {
                messageId,
                chunkIndex: 0,
                totalChunks: 1,
                payload,
                type,
            },
        ];
    }
    const totalChunks = Math.ceil(payload.length / constants_1.CHUNK_SIZE_BYTES);
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
        const start = i * constants_1.CHUNK_SIZE_BYTES;
        const end = Math.min(start + constants_1.CHUNK_SIZE_BYTES, payload.length);
        chunks.push({
            messageId,
            chunkIndex: i,
            totalChunks,
            payload: payload.slice(start, end),
            type,
        });
    }
    return chunks;
}
/**
 * Reassembles an array of ChunkedMessage objects (belonging to the same messageId)
 * into the original payload string. Chunks are ordered by chunkIndex.
 */
function reassembleChunks(chunks) {
    const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    return sorted.map((c) => c.payload).join('');
}
/**
 * Accumulates chunked messages by messageId and emits complete payloads
 * once all chunks for a given message have arrived.
 *
 * Messages that are not completed within REQUEST_TIMEOUT_MS (30s) can be
 * detected via `hasTimedOut` and removed via `cleanup`.
 */
class ChunkBuffer {
    buffer = new Map();
    /**
     * Adds a chunk to the buffer.
     *
     * @returns The reassembled payload if all chunks have arrived, or null
     *          if the message is still incomplete.
     */
    addChunk(chunk) {
        const { messageId, chunkIndex, totalChunks } = chunk;
        if (!this.buffer.has(messageId)) {
            this.buffer.set(messageId, {
                chunks: new Map(),
                totalChunks,
                createdAt: Date.now(),
            });
        }
        const entry = this.buffer.get(messageId);
        entry.chunks.set(chunkIndex, chunk);
        if (entry.chunks.size === entry.totalChunks) {
            const allChunks = Array.from(entry.chunks.values());
            this.buffer.delete(messageId);
            return reassembleChunks(allChunks);
        }
        return null;
    }
    /**
     * Returns true if the message identified by messageId has been waiting
     * longer than REQUEST_TIMEOUT_MS (30 seconds).
     */
    hasTimedOut(messageId, now) {
        const entry = this.buffer.get(messageId);
        if (!entry) {
            return false;
        }
        const currentTime = now ?? Date.now();
        return currentTime - entry.createdAt >= constants_1.REQUEST_TIMEOUT_MS;
    }
    /**
     * Removes all timed-out messages from the buffer.
     */
    cleanup(now) {
        const currentTime = now ?? Date.now();
        const toDelete = [];
        this.buffer.forEach((entry, messageId) => {
            if (currentTime - entry.createdAt >= constants_1.REQUEST_TIMEOUT_MS) {
                toDelete.push(messageId);
            }
        });
        for (const id of toDelete) {
            this.buffer.delete(id);
        }
    }
}
exports.ChunkBuffer = ChunkBuffer;
//# sourceMappingURL=chunker.js.map