import { ChunkedMessage } from './types';
/**
 * Splits a payload into one or more ChunkedMessage frames.
 *
 * - If the payload fits within MAX_FRAME_BYTES (32KB), it is sent as a single
 *   CompleteMessage (totalChunks = 1).
 * - Otherwise, the payload is split into chunks of at most CHUNK_SIZE_BYTES (28KB),
 *   leaving room for envelope metadata in each WebSocket frame.
 */
export declare function chunkMessage(payload: string, type: 'request' | 'response'): ChunkedMessage[];
/**
 * Reassembles an array of ChunkedMessage objects (belonging to the same messageId)
 * into the original payload string. Chunks are ordered by chunkIndex.
 */
export declare function reassembleChunks(chunks: ChunkedMessage[]): string;
/**
 * Accumulates chunked messages by messageId and emits complete payloads
 * once all chunks for a given message have arrived.
 *
 * Messages that are not completed within REQUEST_TIMEOUT_MS (30s) can be
 * detected via `hasTimedOut` and removed via `cleanup`.
 */
export declare class ChunkBuffer {
    private buffer;
    /**
     * Adds a chunk to the buffer.
     *
     * @returns The reassembled payload if all chunks have arrived, or null
     *          if the message is still incomplete.
     */
    addChunk(chunk: ChunkedMessage): string | null;
    /**
     * Returns true if the message identified by messageId has been waiting
     * longer than REQUEST_TIMEOUT_MS (30 seconds).
     */
    hasTimedOut(messageId: string, now?: number): boolean;
    /**
     * Removes all timed-out messages from the buffer.
     */
    cleanup(now?: number): void;
}
//# sourceMappingURL=chunker.d.ts.map