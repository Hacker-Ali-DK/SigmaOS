import { db } from '@/lib/db';
import { eventReliabilityManager } from './event-reliability';
import { PerformanceQueue } from './performance-queue';
import { crossModuleReactionSystem } from './reaction-system';
import { EventPriorityMap } from './event-catalog';
import type { EventEnvelope, PriorityTier, SubscriberCallback, SubscriberRegistration } from './types';

class EventBusEngine {
  private subscribers: Map<string, SubscriberRegistration> = new Map();
  private performanceQueue = new PerformanceQueue();

  constructor() {
    // Replay unacknowledged events on startup
    if (typeof window !== 'undefined') {
      this.replayPendingEvents().catch(console.error);
    }
  }

  /**
   * Registers a subscriber callback for a specific topic or wildcard pattern
   */
  subscribe<T = any>(
    subscriberId: string,
    topicPattern: string,
    callback: SubscriberCallback<T>,
    priority: PriorityTier = 'P2'
  ): () => void {
    this.subscribers.set(subscriberId, {
      id: subscriberId,
      topicPattern,
      priority,
      callback
    });

    // Return un-subscribe function
    return () => {
      this.subscribers.delete(subscriberId);
    };
  }

  /**
   * Publishes an event payload to the central Event Bus
   */
  async publish<T = any>(
    topic: string,
    payload: T,
    parentEnvelope?: EventEnvelope
  ): Promise<EventEnvelope<T> | null> {
    const traceId = parentEnvelope ? parentEnvelope.traceId : `trc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const causalDepth = parentEnvelope ? parentEnvelope.causalDepth + 1 : 0;

    // Validate DAG Reaction depth
    if (parentEnvelope) {
      const { isValid } = crossModuleReactionSystem.validateReaction(parentEnvelope, topic);
      if (!isValid) return null;
    }

    const timestamp = Date.now();
    const idempotencyKey = eventReliabilityManager.generateIdempotencyKey(topic, timestamp, payload);

    // Duplicate event check
    if (eventReliabilityManager.isDuplicate(idempotencyKey)) {
      return null;
    }

    const priority: PriorityTier = EventPriorityMap[topic] || 'P2';

    const envelope: EventEnvelope<T> = {
      traceId,
      causalDepth,
      topic,
      priority,
      payload,
      idempotencyKey,
      timestamp,
      acknowledged: false
    };

    // Persist to Dexie db.eventStore
    try {
      const dbId = await db.eventStore.add(envelope);
      envelope.id = dbId;
    } catch (err) {
      console.warn("[EventBus] Event persistence skipped:", err);
    }

    // Queue for performance-optimized execution
    this.performanceQueue.enqueue(envelope, (envelopesToProcess) => {
      for (const env of envelopesToProcess) {
        this.dispatchToSubscribers(env);
      }
    });

    return envelope;
  }

  /**
   * Routes envelope to matching subscriber callbacks
   */
  private async dispatchToSubscribers(envelope: EventEnvelope): Promise<void> {
    for (const sub of this.subscribers.values()) {
      if (this.isTopicMatch(sub.topicPattern, envelope.topic)) {
        try {
          await sub.callback(envelope);
        } catch (err) {
          console.error(`[EventBus] Subscriber ${sub.id} error on ${envelope.topic}:`, err);
          await eventReliabilityManager.moveToDeadLetter(envelope, err);
        }
      }
    }

    // Mark as acknowledged in Dexie
    if (envelope.id) {
      await db.eventStore.update(envelope.id, { acknowledged: true });
    }
  }

  /**
   * Wildcard topic pattern matching (e.g. 'log.*.created' or 'score.#')
   */
  private isTopicMatch(pattern: string, topic: string): boolean {
    if (pattern === '#' || pattern === '*' || pattern === topic) return true;
    const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.] process+').replace(/#/g, '.*') + '$';
    return new RegExp(regexPattern).test(topic);
  }

  /**
   * Replays pending unacknowledged events from Dexie eventStore upon startup
   */
  async replayPendingEvents(): Promise<void> {
    try {
      const pendingEvents = await db.eventStore.where({ acknowledged: false }).sortBy('id');
      for (const env of pendingEvents) {
        await this.dispatchToSubscribers(env);
      }
    } catch (err) {
      // Table may be initializing
    }
  }
}

export const eventBus = new EventBusEngine();
