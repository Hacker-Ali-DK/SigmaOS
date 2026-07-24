import type { EventEnvelope, PriorityTier } from './types';

export class PerformanceQueue {
  private queue: EventEnvelope[] = [];
  private batchBuffer: Map<string, EventEnvelope> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchWindowMs = 300;

  /**
   * Priority weight ordering: P0 = 0 (Highest), P1 = 1, P2 = 2, P3 = 3 (Lowest)
   */
  private getPriorityWeight(priority: PriorityTier): number {
    switch (priority) {
      case 'P0': return 0;
      case 'P1': return 1;
      case 'P2': return 2;
      case 'P3': return 3;
      default: return 2;
    }
  }

  /**
   * Adds an event to the micro-batching buffer or priority queue
   */
  enqueue(envelope: EventEnvelope, onFlushBatch: (envelopes: EventEnvelope[]) => void): void {
    // P0 Urgent events bypass micro-batching immediately
    if (envelope.priority === 'P0') {
      this.insertPriority(envelope);
      onFlushBatch(this.flushQueue());
      return;
    }

    // P1, P2, P3 events undergo 300ms micro-batching
    this.batchBuffer.set(envelope.topic, envelope);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        const batched = Array.from(this.batchBuffer.values());
        this.batchBuffer.clear();
        this.batchTimer = null;

        for (const item of batched) {
          this.insertPriority(item);
        }
        onFlushBatch(this.flushQueue());
      }, this.batchWindowMs);
    }
  }

  private insertPriority(envelope: EventEnvelope): void {
    this.queue.push(envelope);
    this.queue.sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority));
  }

  private flushQueue(): EventEnvelope[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }
}
