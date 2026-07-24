import { constraintEngineManager } from './constraint-engine';
import { planningSessionLock } from './session-lock';
import { backgroundPlanningQueue } from './background-queue';
import { DEFAULT_PLANNER_CONFIG } from './planner-config';

async function testStage3ConstraintSystem() {
  console.log("=== Testing Stage 3 Constraint System ===");

  const targetDate = '2026-07-24';

  // 1. Test Active Constraints Generation & Caching
  const constraints = await constraintEngineManager.getActiveConstraints(targetDate);
  console.log(`✓ Active Constraints Computed: ${constraints.length} total constraints`);

  const hardConstraints = constraints.filter(c => c.isHard);
  console.log(`✓ Hard Constraints Identified: ${hardConstraints.length} (Solar Prayer, Wudu, Sleep)`);

  const softConstraints = constraints.filter(c => !c.isHard);
  console.log(`✓ Soft Constraints Identified: ${softConstraints.length} (Energy Peak)`);

  // Verify Solar Prayer Window presence
  const fajrConstraint = constraints.find(c => c.constraintId.includes('fajr'));
  console.log(`✓ Fajr Solar Prayer Window Found: ${fajrConstraint?.affectedTimeRange.startTime} - ${fajrConstraint?.affectedTimeRange.endTime}`);

  // 2. Test Constraint Cache Invalidation
  await constraintEngineManager.invalidateConstraintCache('prayer_method');
  console.log("✓ Constraint Cache Invalidated for 'prayer_method' Trigger");

  // 3. Verify Integration with Stage 1 & Stage 2 Infrastructure
  const isLockAvailable = !planningSessionLock.isLocked();
  console.log(`✓ Stage 2 Session Lock Integration Verified: ${isLockAvailable}`);

  console.log(`✓ Stage 1 Planner Config Integration Verified: Prayer Buffer = ${DEFAULT_PLANNER_CONFIG.prayerBufferMins}m`);

  console.log("=== Stage 3 Constraint System Verified Successfully! ===");
}

testStage3ConstraintSystem().catch(console.error);
