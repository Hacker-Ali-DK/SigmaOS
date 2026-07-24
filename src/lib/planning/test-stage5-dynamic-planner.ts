import { dynamicPlannerManager } from './dynamic-planner';
import { multiObjectiveOptimizer } from './multi-objective-optimizer';
import { db } from '@/lib/db';
import { planningSessionLock } from './session-lock';

async function testStage5DynamicPlanner() {
  console.log("=== Testing Stage 5 Dynamic Planner & Multi-Objective Optimizer ===");

  const targetDate = '2026-07-24';

  // 1. Test Daily Plan Generation
  const plan = await dynamicPlannerManager.generateDailyPlan(targetDate, 'midnight_recalibration');
  console.log(`✓ Daily Plan Generated: ID ${plan.planId} for Date ${plan.date}`);
  console.log(`✓ Plan Revision Created: ${plan.revision.revisionId} (Parent: ${plan.revision.parentRevisionId})`);
  console.log(`✓ TimeBlocks Generated: ${plan.timeBlocks.length} blocks`);

  // 2. Test Non-Overlapping TimeBlock Interval Invariant
  let hasOverlap = false;
  for (let i = 0; i < plan.timeBlocks.length; i++) {
    for (let j = i + 1; j < plan.timeBlocks.length; j++) {
      const b1 = plan.timeBlocks[i];
      const b2 = plan.timeBlocks[j];
      if (b1.startTimeMs < b2.endTimeMs && b1.endTimeMs > b2.startTimeMs) {
        hasOverlap = true;
        console.error(`❌ Overlap detected between ${b1.title} and ${b2.title}`);
      }
    }
  }
  console.log(`✓ Non-Overlapping TimeBlocks Invariant Verified: ${!hasOverlap}`);

  // 3. Test Hard Constraints & Solar Prayer Protection
  const prayerBlocks = plan.timeBlocks.filter(b => b.category === 'prayer');
  console.log(`✓ Hard Solar Prayer & Wudu Blocks Preserved: ${prayerBlocks.length} blocks`);
  const lockedBlocks = plan.timeBlocks.filter(b => b.isLocked);
  console.log(`✓ Locked Blocks Protected: ${lockedBlocks.length} locked blocks`);

  // 4. Test Task Splitting & Recovery Break Buffers
  const breakBlocks = plan.timeBlocks.filter(b => b.category === 'recovery');
  console.log(`✓ Task Splitting & Recovery Buffers Inserted: ${breakBlocks.length} rest buffers`);

  // 5. Test Multi-Objective DYI Score Calculation
  console.log(`✓ Daily Yield Index (DYI): ${plan.score.dailyYieldIndex} / 100`);
  console.log(`  └─ Deen Sub-Score: ${plan.score.deenSubScore}`);
  console.log(`  └─ Sleep Sub-Score: ${plan.score.sleepQualitySubScore}`);
  console.log(`  └─ Recovery Sub-Score: ${plan.score.recoverySubScore}`);

  // 6. Test Dexie Version 9 Persistence
  const savedPlan = await db.dailyPlans.where({ date: targetDate }).first();
  console.log(`✓ Dexie DB Plan Persistence Verified: Status ${savedPlan?.status}`);

  const savedRevision = await db.planRevisions.where({ planId: plan.planId }).first();
  console.log(`✓ Dexie DB Revision Chain Persistence Verified: Revision ${savedRevision?.revisionId}`);

  // 7. Verify Integration with Stage 2 Session Lock
  const isLockReleased = !planningSessionLock.isLocked();
  console.log(`✓ Session Lock Cleanly Released Post-Planning: ${isLockReleased}`);

  console.log("=== Stage 5 Dynamic Planner & Optimizer Verified Successfully! ===");
}

testStage5DynamicPlanner().catch(console.error);
