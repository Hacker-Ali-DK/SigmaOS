/**
 * Recovery+ Architecture Phase 5 Event Bus TypeScript Definitions
 */

export type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3';

export interface EventEnvelope<T = any> {
  id?: number;
  traceId: string;
  causalDepth: number;
  topic: string;
  priority: PriorityTier;
  payload: T;
  idempotencyKey: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface EventDeadLetterRecord {
  id?: number;
  topic: string;
  payload: any;
  error: string;
  timestamp: number;
}

export type SubscriberCallback<T = any> = (envelope: EventEnvelope<T>) => Promise<void> | void;

export interface SubscriberRegistration {
  id: string;
  topicPattern: string;
  priority: PriorityTier;
  callback: SubscriberCallback;
}
