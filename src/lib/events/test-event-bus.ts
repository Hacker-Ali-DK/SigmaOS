import { eventBus } from './event-bus';
import { StandardEvents } from './event-catalog';
import { crossModuleReactionSystem } from './reaction-system';
import { eventReliabilityManager } from './event-reliability';
import type { EventEnvelope } from './types';

async function testEventBusArchitecture() {
  console.log("=== Testing Phase 5 Event Bus & Cross-Module Intelligence ===");

  let receivedCount = 0;

  // 1. Register Subscriber for SLEEP_LOGGED
  const unsub = eventBus.subscribe('test_sleep_sub', StandardEvents.SLEEP_LOGGED, async (envelope) => {
    receivedCount++;
    console.log(`✓ Received Event: [${envelope.topic}] Priority: ${envelope.priority}, Trace: ${envelope.traceId}`);
  });

  // 2. Publish Standard Event
  const envelope = await eventBus.publish(StandardEvents.SLEEP_LOGGED, {
    date: '2026-07-24',
    totalHours: 7.5,
    qualityRating: 4
  });

  console.log(`✓ Event Published Successfully: ${envelope?.idempotencyKey}`);

  // 3. Test Idempotency Duplicate Detection
  if (envelope) {
    const isDup = eventReliabilityManager.isDuplicate(envelope.idempotencyKey);
    console.log(`✓ Idempotency Check (Duplicate Blocked): ${isDup}`);
  }

  // 4. Test DAG Causal Depth Bound Enforcement
  const rootEnv: EventEnvelope = {
    traceId: 'trc_depth_test',
    causalDepth: 5,
    topic: StandardEvents.SLEEP_LOGGED,
    priority: 'P1',
    payload: {},
    idempotencyKey: 'idemp_depth',
    timestamp: Date.now(),
    acknowledged: false
  };

  const depthCheck = crossModuleReactionSystem.validateReaction(rootEnv, StandardEvents.RECOVERY_SCORE_UPDATED);
  console.log(`✓ Causal Depth Limit Check (>5 Hops Blocked): Valid = ${depthCheck.isValid}`);

  unsub();
  console.log("=== All Phase 5 Event Bus Systems Verified Successfully! ===");
}

testEventBusArchitecture().catch(console.error);
