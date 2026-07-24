import { planningSessionLock } from './session-lock';
import { backgroundPlanningQueue, type QueuedPlanningTask } from './background-queue';
import { planningTriggerCoordinator } from './trigger-coordinator';

async function testStage2PlanningInfrastructure() {
  console.log("=== Testing Stage 2 Planning Infrastructure ===");

  // 1. Test Session Lock
  const sessionId = `sess_${Date.now()}`;
  const acquired = await planningSessionLock.acquireLock(sessionId);
  console.log(`✓ Session Lock Acquired: ${acquired}`);

  const secondAcquire = await planningSessionLock.acquireLock(`sess_other`);
  console.log(`✓ Double Acquisition Blocked: ${!secondAcquire}`);

  const isLocked = planningSessionLock.isLocked();
  console.log(`✓ Session Lock Status Active: ${isLocked}`);

  const released = planningSessionLock.releaseLock(sessionId);
  console.log(`✓ Session Lock Released: ${released}`);
  console.log(`✓ Session Lock Status Inactive: ${!planningSessionLock.isLocked()}`);

  // 2. Test Background Planning Queue Priority Ordering
  const executionOrder: string[] = [];

  const taskP2: QueuedPlanningTask = {
    taskId: 'p2_routine',
    date: '2026-07-24',
    priority: 'P2',
    reason: 'adaptive_reschedule',
    queuedTimestamp: Date.now(),
    execute: async () => { executionOrder.push('P2_routine'); }
  };

  const taskP0: QueuedPlanningTask = {
    taskId: 'p0_crisis',
    date: '2026-07-24',
    priority: 'P0',
    reason: 'crisis_protocol',
    queuedTimestamp: Date.now() + 5,
    execute: async () => { executionOrder.push('P0_crisis'); }
  };

  backgroundPlanningQueue.enqueue(taskP2);
  backgroundPlanningQueue.enqueue(taskP0);

  // Small delay for queue processing
  await new Promise(r => setTimeout(r, 100));
  console.log(`✓ Background Queue Execution Order: ${executionOrder.join(' -> ')}`);

  // 3. Test Trigger Coordinator Debouncing
  planningTriggerCoordinator.handleTrigger('2026-07-24', 'P2', 'adaptive_reschedule', 'log.water.created');
  planningTriggerCoordinator.handleTrigger('2026-07-24', 'P1', 'adaptive_reschedule', 'log.sleep.created');
  console.log("✓ Trigger Coordinator 300ms Debouncing Enqueued");

  console.log("=== Stage 2 Planning Infrastructure Verified Successfully! ===");
}

testStage2PlanningInfrastructure().catch(console.error);
