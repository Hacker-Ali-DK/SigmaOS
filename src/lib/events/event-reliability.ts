import { db } from '@/lib/db';
import type { EventEnvelope, EventDeadLetterRecord } from './types';

class EventReliabilityManager {
  private processedKeys = new Set<string>();

  /**
   * Generates a deterministic Idempotency Key for an event payload
   */
  generateIdempotencyKey(topic: string, timestamp: number, payload: any): string {
    const raw = `${topic}:${timestamp}:${JSON.stringify(payload)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `idemp_${Math.abs(hash)}`;
  }

  /**
   * Checks if an event key has already been marked processed (read only, no state mutation)
   */
  hasDuplicate(idempotencyKey: string): boolean {
    return this.processedKeys.has(idempotencyKey);
  }

  /**
   * Alias for backward compatibility
   */
  isDuplicate(idempotencyKey: string): boolean {
    return this.hasDuplicate(idempotencyKey);
  }

  /**
   * Registers an event idempotency key after successful publication
   */
  markProcessed(idempotencyKey: string): void {
    this.processedKeys.add(idempotencyKey);
    // Keep in-memory bloom filter bounded at 500 keys
    if (this.processedKeys.size > 500) {
      const firstKey = this.processedKeys.values().next().value;
      if (firstKey) this.processedKeys.delete(firstKey);
    }
  }

  /**
   * Offloads failed event to Dead Letter Queue in Dexie db.eventDeadLetter
   */
  async moveToDeadLetter(envelope: EventEnvelope, error: any): Promise<void> {
    const record: EventDeadLetterRecord = {
      topic: envelope.topic,
      payload: envelope.payload,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now()
    };
    await db.eventDeadLetter.add(record);
  }
}

export const eventReliabilityManager = new EventReliabilityManager();
