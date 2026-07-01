import { v4 as uuidv4 } from 'uuid';
import { ChunkedMessage } from './types';
import { CHUNK_SIZE_BYTES, MAX_FRAME_BYTES, REQUEST_TIMEOUT_MS } from './constants';

/**
 * Splits a payload into one or more ChunkedMessage frames.
 *
 * - If the payload fits within MAX_FRAME_BYTES (32KB), it is sent as a single
 *   CompleteMessage (totalChunks = 1).
 * - Otherwise, the payload is split into chunks of at most CHUNK_SIZE_BYTES (28KB),
 *   leaving room for envelope metadata in each WebSocket frame.
 */
export function chunkMessage(
  payload: string,
  type: 'request' | 'response'
): ChunkedMessage[] {
  const messageId = uuidv4();

  if (payload.length <= MAX_FRAME_BYTES) {
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

  const totalChunks = Math.ceil(payload.length / CHUNK_SIZE_BYTES);
  const chunks: ChunkedMessage[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE_BYTES;
    const end = Math.min(start + CHUNK_SIZE_BYTES, payload.length);
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
export function reassembleChunks(chunks: ChunkedMessage[]): string {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  return sorted.map((c) => c.payload).join('');
}

/**
 * Internal state for a message being accumulated in the ChunkBuffer.
 */
interface BufferEntry {
  chunks: Map<number, ChunkedMessage>;
  totalChunks: number;
  createdAt: number;
}

/**
 * Accumulates chunked messages by messageId and emits complete payloads
 * once all chunks for a given message have arrived.
 *
 * Messages that are not completed within REQUEST_TIMEOUT_MS (30s) can be
 * detected via `hasTimedOut` and removed via `cleanup`.
 */
export class ChunkBuffer {
  private buffer = new Map<string, BufferEntry>();

  /**
   * Adds a chunk to the buffer.
   *
   * @returns The reassembled payload if all chunks have arrived, or null
   *          if the message is still incomplete.
   */
  addChunk(chunk: ChunkedMessage): string | null {
    const { messageId, chunkIndex, totalChunks } = chunk;

    if (!this.buffer.has(messageId)) {
      this.buffer.set(messageId, {
        chunks: new Map(),
        totalChunks,
        createdAt: Date.now(),
      });
    }

    const entry = this.buffer.get(messageId)!;
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
  hasTimedOut(messageId: string, now?: number): boolean {
    const entry = this.buffer.get(messageId);
    if (!entry) {
      return false;
    }
    const currentTime = now ?? Date.now();
    return currentTime - entry.createdAt >= REQUEST_TIMEOUT_MS;
  }

  /**
   * Removes all timed-out messages from the buffer.
   */
  cleanup(now?: number): void {
    const currentTime = now ?? Date.now();
    const toDelete: string[] = [];
    this.buffer.forEach((entry, messageId) => {
      if (currentTime - entry.createdAt >= REQUEST_TIMEOUT_MS) {
        toDelete.push(messageId);
      }
    });
    for (const id of toDelete) {
      this.buffer.delete(id);
    }
  }
}
