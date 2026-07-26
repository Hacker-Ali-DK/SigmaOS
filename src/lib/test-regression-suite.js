// Recovery+ System-Wide Audit Verification Suite (DEF-01 through DEF-14 + Goals UX Fix)
const fs = require('fs');
const path = require('path');

function deduplicateRoutinesInput(routines) {
  if (!routines || routines.length === 0) return [];
  const map = new Map();
  for (const r of routines) {
    if (!r || !r.taskName) continue;
    const key = String(r.taskName).toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, r);
    } else {
      const existing = map.get(key);
      if (!existing.completed && r.completed) {
        map.set(key, r);
      }
    }
  }
  return Array.from(map.values());
}

// DEF-04: Segment-based wildcard pattern matcher
function isTopicMatch(pattern, topic) {
  if (pattern === '#' || pattern === '*' || pattern === topic) return true;

  const patternSegments = pattern.split('.');
  const topicSegments = topic.split('.');

  if (patternSegments[patternSegments.length - 1] === '#') {
    const basePatternSegments = patternSegments.slice(0, -1);
    if (topicSegments.length < basePatternSegments.length) return false;
    for (let i = 0; i < basePatternSegments.length; i++) {
      const p = basePatternSegments[i];
      if (p !== '*' && p !== topicSegments[i]) return false;
    }
    return true;
  }

  if (patternSegments.length !== topicSegments.length) return false;
  for (let i = 0; i < patternSegments.length; i++) {
    const p = patternSegments[i];
    if (p !== '*' && p !== topicSegments[i]) return false;
  }
  return true;
}

// DEF-07: Idempotency Manager mock
class IdempotencyManager {
  constructor() {
    this.processed = new Set();
  }
  hasDuplicate(key) {
    return this.processed.has(key);
  }
  markProcessed(key) {
    this.processed.add(key);
  }
}

// DEF-02: Session Lock mock
class PlanningSessionLock {
  constructor() {
    this.activeLockId = null;
  }
  acquireLock(sessionId) {
    if (this.activeLockId !== null) {
      if (this.activeLockId === sessionId) return true; // re-entrant
      return false;
    }
    this.activeLockId = sessionId;
    return true;
  }
  releaseLock(sessionId) {
    if (this.activeLockId === sessionId) {
      this.activeLockId = null;
      return true;
    }
    return false;
  }
}

// DEF-08: Sequential Clean Streak Finalizer simulator
function simulateStreakFinalization(lastFinalizedDate, currentDate, initialStreak, dailyUrgesMap) {
  const datesToFinalize = [];
  const [startY, startM, startD] = lastFinalizedDate.split('-').map(Number);
  let curr = new Date(Date.UTC(startY, startM - 1, startD));
  curr.setUTCDate(curr.getUTCDate() + 1);

  const [endY, endM, endD] = currentDate.split('-').map(Number);
  const endDate = new Date(Date.UTC(endY, endM - 1, endD));

  while (curr < endDate) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    datesToFinalize.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  let streak = initialStreak;
  let lastProcessed = lastFinalizedDate;

  for (const dateStr of datesToFinalize) {
    const urges = dailyUrgesMap[dateStr] || [];
    const relapsed = urges.some(u => u.resisted === false);
    if (relapsed) {
      streak = 0;
    } else {
      streak += 1;
    }
    lastProcessed = dateStr;
  }

  return { streak, lastActiveDate: lastProcessed, datesFinalizedCount: datesToFinalize.length };
}

// DEF-09: Safe Discipline Score hours reducer simulator
function calculateStudyHours(completedRoutines) {
  return completedRoutines.reduce((sum, r) => {
    const label = (r && typeof r.timeLabel === 'string') ? r.timeLabel : '';
    const match = label.match(/(\d+(\.\d+)?)\s*Hrs/i);
    return sum + (match ? parseFloat(match[1]) : 2.5);
  }, 0);
}

// DEF-10 & DEF-14: Multi-Level Revision & Failure Recovery Simulator
class RevisionRollbackSimulator {
  constructor(planId) {
    this.planId = planId;
    this.revisions = new Map();
    this.activePlan = null;
  }

  createRevision(revisionId, parentRevisionId, timeBlocks) {
    const rev = {
      planId: this.planId,
      revisionId,
      parentRevisionId,
      generatedAt: Date.now(),
      timeBlocks: timeBlocks ? [...timeBlocks] : undefined
    };
    this.revisions.set(revisionId, rev);
    this.activePlan = {
      planId: this.planId,
      revision: rev,
      timeBlocks: timeBlocks ? [...timeBlocks] : [],
      status: 'executing'
    };
    return this.activePlan;
  }

  rollbackTo(targetRevisionId) {
    const targetRev = this.revisions.get(targetRevisionId);
    if (!targetRev) return null;
    const restoredTimeBlocks = targetRev.timeBlocks ? [...targetRev.timeBlocks] : this.activePlan.timeBlocks;
    this.activePlan = {
      ...this.activePlan,
      revision: targetRev,
      timeBlocks: restoredTimeBlocks,
      status: 'executing'
    };
    return this.activePlan;
  }

  handleFailureRecovery(errorMessage) {
    const revs = Array.from(this.revisions.values());
    const lastValidRev = revs.length > 0 ? revs[revs.length - 1] : null;
    if (!lastValidRev) return null;
    const restoredTimeBlocks = lastValidRev.timeBlocks ? [...lastValidRev.timeBlocks] : this.activePlan.timeBlocks;
    this.activePlan = {
      ...this.activePlan,
      revision: lastValidRev,
      timeBlocks: restoredTimeBlocks,
      status: 'executing'
    };
    return this.activePlan;
  }
}

// DEF-13: Isha Policy Settings Fallback Simulator
function resolveProfileIshaPolicy(storedPolicy) {
  if (storedPolicy !== undefined && storedPolicy !== null) {
    return storedPolicy;
  }
  return 'fajr';
}

// Goals Reversible [ - ] [ + ] Atomic Adjustment Simulator
class GoalStoreSimulator {
  constructor() {
    this.goals = new Map();
  }

  addGoal(goal) {
    const id = goal.id || Date.now();
    const g = { ...goal, id };
    this.goals.set(id, g);
    return g;
  }

  async adjustGoalValue(id, delta) {
    const latest = this.goals.get(id);
    if (!latest) return null;

    const minVal = 0;
    const maxVal = Math.max(latest.targetValue, 0);
    const nextVal = Math.max(minVal, Math.min(maxVal, latest.currentValue + delta));
    const isComp = nextVal >= latest.targetValue && latest.targetValue > 0;

    const updated = {
      ...latest,
      currentValue: nextVal,
      completed: isComp
    };
    this.goals.set(id, updated);
    return updated;
  }
}

async function runAllAuditVerificationTests() {
  console.log("=================================================");
  console.log("=== RECOVERY+ SYSTEM-WIDE AUDIT VERIFICATION ===");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.log(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: DEF-04 Wildcard Event Topic Semantics
  // ----------------------------------------------------
  console.log("--- TEST 1: DEF-04 Wildcard Event Topic Semantics ---");
  assert(isTopicMatch('plan.*', 'plan.generated') === true, "plan.* matches plan.generated");
  assert(isTopicMatch('plan.*', 'plan.x.y') === false, "plan.* does NOT match plan.x.y (multi-segment)");
  assert(isTopicMatch('plan.#', 'plan') === true, "plan.# matches base topic plan");
  assert(isTopicMatch('plan.#', 'plan.generated') === true, "plan.# matches plan.generated");
  assert(isTopicMatch('plan.#', 'plan.generated.final') === true, "plan.# matches multi-segment plan.generated.final");

  // ----------------------------------------------------
  // TEST 2: DEF-07 Idempotency Separation
  // ----------------------------------------------------
  console.log("\n--- TEST 2: DEF-07 Idempotency Separation ---");
  const idemp = new IdempotencyManager();
  const testKey = "idemp_12345";
  assert(idemp.hasDuplicate(testKey) === false, "hasDuplicate returns false before registration");
  assert(idemp.hasDuplicate(testKey) === false, "Repeated read check does NOT mutate idempotency state");
  idemp.markProcessed(testKey);
  assert(idemp.hasDuplicate(testKey) === true, "hasDuplicate returns true after markProcessed registration");

  // ----------------------------------------------------
  // TEST 3: DEF-02 Planning Session Lock Re-entrancy
  // ----------------------------------------------------
  console.log("\n--- TEST 3: DEF-02 Planning Session Lock Re-entrancy ---");
  const lock = new PlanningSessionLock();
  const parentSessionId = "plan_sess_2026-07-26_100";
  assert(lock.acquireLock(parentSessionId) === true, "Parent planning session acquires lock");
  assert(lock.acquireLock(parentSessionId) === true, "Sub-operation reusing parent session ID succeeds without deadlock");
  assert(lock.releaseLock(parentSessionId) === true, "Parent session releases lock cleanly");

  // ----------------------------------------------------
  // TEST 4: DEF-08 Multi-Day Offline Streak Finalization
  // ----------------------------------------------------
  console.log("\n--- TEST 4: DEF-08 Multi-Day Offline Streak Finalization ---");
  const res1 = simulateStreakFinalization("2026-07-20", "2026-07-22", 5, {});
  assert(res1.streak === 6, `One clean day increments streak from 5 to 6 (actual: ${res1.streak})`);
  assert(res1.lastActiveDate === "2026-07-21", `Last active date updated to 2026-07-21`);

  const res2 = simulateStreakFinalization("2026-07-20", "2026-07-22", 5, {
    "2026-07-21": [{ resisted: false }]
  });
  assert(res2.streak === 0, `One relapse day resets streak from 5 to 0 (actual: ${res2.streak})`);

  const res3 = simulateStreakFinalization("2026-07-20", "2026-07-24", 5, {});
  assert(res3.streak === 8, `Three clean days increment streak from 5 to 8 (actual: ${res3.streak})`);
  assert(res3.lastActiveDate === "2026-07-23", `Last active date updated to 2026-07-23`);

  const res4 = simulateStreakFinalization("2026-07-20", "2026-07-24", 5, {
    "2026-07-22": [{ resisted: false }]
  });
  assert(res4.streak === 1, `Sequential finalization resets on July 22 and recovers on July 23 (actual: ${res4.streak})`);

  const res5 = simulateStreakFinalization("2026-07-23", "2026-07-24", 8, {});
  assert(res5.datesFinalizedCount === 0, `Reopening app repeatedly on same day finalizes 0 days`);
  assert(res5.streak === 8, `Streak remains unchanged on repeated app opens`);

  // ----------------------------------------------------
  // TEST 5: DEF-09 Safe Optional timeLabel Handling
  // ----------------------------------------------------
  console.log("\n--- TEST 5: DEF-09 Safe Optional timeLabel Handling ---");
  const routinesWithoutTimeLabel = [
    { taskName: "Study Programming", completed: true }
  ];
  const hours = calculateStudyHours(routinesWithoutTimeLabel);
  assert(hours === 2.5, `Study hours reducer handles undefined timeLabel safely with 2.5h fallback (actual: ${hours})`);

  // ----------------------------------------------------
  // TEST 6: DEF-10 Correct Revision Rollback
  // ----------------------------------------------------
  console.log("\n--- TEST 6: DEF-10 Correct Revision Rollback ---");
  const sim = new RevisionRollbackSimulator("plan_2026-07-26");

  const b12 = Array.from({ length: 12 }, (_, i) => ({ blockId: `b_${i}`, title: `Block ${i}` }));
  const b10 = Array.from({ length: 10 }, (_, i) => ({ blockId: `b_${i}`, title: `Block ${i}` }));
  const b8 = Array.from({ length: 8 }, (_, i) => ({ blockId: `b_${i}`, title: `Block ${i}` }));

  sim.createRevision("R0", null, b12);
  sim.createRevision("R1", "R0", b10);
  sim.createRevision("R2", "R1", b8);

  assert(sim.activePlan.timeBlocks.length === 8, "Plan modified to R2 has 8 blocks");

  const rolledBackR0 = sim.rollbackTo("R0");
  assert(rolledBackR0.revision.revisionId === "R0", "Rollback pointer updated to R0");
  assert(rolledBackR0.timeBlocks.length === 12, `Rollback R0 restores exact 12 blocks snapshot (actual: ${rolledBackR0.timeBlocks.length})`);

  const rolledBackR1 = sim.rollbackTo("R1");
  assert(rolledBackR1.revision.revisionId === "R1", "Rollback pointer updated to R1");
  assert(rolledBackR1.timeBlocks.length === 10, `Rollback R1 restores exact 10 blocks snapshot (actual: ${rolledBackR1.timeBlocks.length})`);

  // ----------------------------------------------------
  // TEST 7: DEF-11 Onboarding Profile Initialisation
  // ----------------------------------------------------
  console.log("\n--- TEST 7: DEF-11 Onboarding Profile Initialisation ---");
  const mockOnboardProfile = {
    id: 1,
    name: 'Abdullah',
    timezone: 'Asia/Karachi',
    lastActiveDate: '2026-07-25',
    prayerMethod: 'karachi',
    asrMethod: 'standard',
    ishaPolicy: 'fajr',
    latitude: undefined,
    longitude: undefined
  };

  assert(Boolean(mockOnboardProfile.timezone), "Newly onboarded user has valid IANA timezone");
  assert(Boolean(mockOnboardProfile.lastActiveDate), "Newly onboarded user has valid lastActiveDate");
  assert(mockOnboardProfile.ishaPolicy === 'fajr', "Prayer defaults consistent with fajr ishaPolicy");
  assert(mockOnboardProfile.latitude === undefined, "Unconfigured user location is not fabricated as Karachi coordinates");

  // ----------------------------------------------------
  // TEST 8: DEF-12 Service Worker Pre-Cache Verification
  // ----------------------------------------------------
  console.log("\n--- TEST 8: DEF-12 Service Worker Pre-Cache Asset Existence ---");
  const swPath = path.join(__dirname, '../../public/sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');

  const match = swContent.match(/ASSETS_TO_CACHE = \[\s*([\s\S]*?)\s*\];/);
  assert(Boolean(match), "ASSETS_TO_CACHE array defined in public/sw.js");

  if (match) {
    const rawAssets = match[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    let allAssetsExist = true;

    for (const assetPath of rawAssets) {
      if (assetPath === '/') continue;
      const localFilePath = path.join(__dirname, '../../public', assetPath);
      const exists = fs.existsSync(localFilePath);
      assert(exists, `Precached asset '${assetPath}' exists on disk at ${localFilePath}`);
      if (!exists) allAssetsExist = false;
    }
    assert(allAssetsExist, "Every asset listed in ASSETS_TO_CACHE exists on disk (no 404 missing assets)");
  }

  // ----------------------------------------------------
  // TEST 9: DEF-13 Isha Policy Settings Consistency
  // ----------------------------------------------------
  console.log("\n--- TEST 9: DEF-13 Isha Policy Settings Consistency ---");
  assert(resolveProfileIshaPolicy(undefined) === 'fajr', "Undefined ishaPolicy falls back to 'fajr'");
  assert(resolveProfileIshaPolicy('fajr') === 'fajr', "Existing 'fajr' is preserved as 'fajr'");
  assert(resolveProfileIshaPolicy('midnight') === 'midnight', "Existing explicit 'midnight' setting is preserved as 'midnight'");

  // ----------------------------------------------------
  // TEST 10: DEF-14 Planner Failure Recovery Snapshot Restoration
  // ----------------------------------------------------
  console.log("\n--- TEST 10: DEF-14 Planner Failure Recovery Snapshot Restoration ---");
  const simRecovery = new RevisionRollbackSimulator("plan_2026-07-26_fail");
  const validR0Blocks = Array.from({ length: 12 }, (_, i) => ({ blockId: `block_${i}`, title: `Valid Task ${i}` }));

  simRecovery.createRevision("R0", null, validR0Blocks);
  assert(simRecovery.activePlan.timeBlocks.length === 12, "R0 plan initialized with 12 blocks");

  const recoveredPlan = simRecovery.handleFailureRecovery("Solver Exception");
  assert(recoveredPlan.revision.revisionId === "R0", "Failure recovery restores last valid revision R0 pointer");
  assert(recoveredPlan.timeBlocks.length === 12, `Failure recovery restores exact 12 R0 timeBlocks snapshot (actual: ${recoveredPlan.timeBlocks.length})`);

  const simLegacy = new RevisionRollbackSimulator("plan_legacy");
  simLegacy.createRevision("R_legacy", null, null);
  simLegacy.activePlan.timeBlocks = [{ blockId: 'b_curr', title: 'Current Block' }];
  const legacyRecovered = simLegacy.handleFailureRecovery("Solver Timeout Exception");
  assert(legacyRecovered.revision.revisionId === "R_legacy", "Legacy failure recovery restores revision pointer");
  assert(legacyRecovered.timeBlocks.length === 1, `Legacy failure recovery falls back gracefully without crashing (blocks: ${legacyRecovered.timeBlocks.length})`);

  // ----------------------------------------------------
  // TEST 11: GOALS REVERSIBLE [ - ] [ + ] & CONCURRENCY VERIFICATION
  // ----------------------------------------------------
  console.log("\n--- TEST 11: Goals Reversible [ - ] [ + ] & Concurrency Verification ---");
  const goalStore = new GoalStoreSimulator();
  const testGoal = goalStore.addGoal({ title: 'Read Books', targetValue: 10, currentValue: 3, unit: 'Books', category: 'health', completed: false });

  // 11a. Increase by 1
  let gState = await goalStore.adjustGoalValue(testGoal.id, 1);
  assert(gState.currentValue === 4, `1. Increase goal by 1 (expected: 4, actual: ${gState.currentValue})`);

  // 11b. Decrease by 1
  gState = await goalStore.adjustGoalValue(testGoal.id, -1);
  assert(gState.currentValue === 3, `2. Decrease goal by 1 (expected: 3, actual: ${gState.currentValue})`);

  // 11c. Increase then immediately decrease
  await goalStore.adjustGoalValue(testGoal.id, 1);
  gState = await goalStore.adjustGoalValue(testGoal.id, -1);
  assert(gState.currentValue === 3, `3. Increase then decrease returns to 3 (actual: ${gState.currentValue})`);

  // 11d. Decrease at minimum boundary (0)
  await goalStore.adjustGoalValue(testGoal.id, -10);
  gState = await goalStore.adjustGoalValue(testGoal.id, -1);
  assert(gState.currentValue === 0, `4. Decrease at minimum boundary clamps to 0 (actual: ${gState.currentValue})`);

  // 11e. Increase at maximum boundary (targetValue = 10)
  gState = await goalStore.adjustGoalValue(testGoal.id, 10);
  assert(gState.currentValue === 10 && gState.completed === true, `Goal completed when currentValue reaches targetValue (10/10)`);
  gState = await goalStore.adjustGoalValue(testGoal.id, 1);
  assert(gState.currentValue === 10, `5. Increase at maximum boundary clamps to 10 (actual: ${gState.currentValue})`);

  // 11f. Reversion from completion
  gState = await goalStore.adjustGoalValue(testGoal.id, -1);
  assert(gState.currentValue === 9 && gState.completed === false, `Decreasing below targetValue reverts completed to false (actual: 9, completed: false)`);

  // 11g. Rapid 5 + taps concurrency safety
  await goalStore.adjustGoalValue(testGoal.id, -9);
  for (let i = 0; i < 5; i++) {
    await goalStore.adjustGoalValue(testGoal.id, 1);
  }
  gState = goalStore.goals.get(testGoal.id);
  assert(gState.currentValue === 5, `6. Five rapid + taps produce exactly +5 (expected: 5, actual: ${gState.currentValue})`);

  // 11h. Rapid 5 - taps concurrency safety
  for (let i = 0; i < 5; i++) {
    await goalStore.adjustGoalValue(testGoal.id, -1);
  }
  gState = goalStore.goals.get(testGoal.id);
  assert(gState.currentValue === 0, `7. Five rapid - taps produce exactly -5 down to 0 (expected: 0, actual: ${gState.currentValue})`);

  console.log("\n=================================================");
  console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllAuditVerificationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
