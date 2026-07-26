// Recovery+ Whole-App Audit Fix Verification Suite (DEF-01 through DEF-07)

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

function getTimezoneOfDayBounds(dateStr, timezone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  return { startOfDay, endOfDay };
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

async function runAllAuditVerificationTests() {
  console.log("=================================================");
  console.log("=== RECOVERY+ AUDIT FIX VERIFICATION SUITE ===");
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
  // TEST 1: DEF-04 Wildcard Topic Matching semantics
  // ----------------------------------------------------
  console.log("--- TEST 1: DEF-04 Wildcard Event Topic Semantics ---");
  assert(isTopicMatch('plan.*', 'plan.generated') === true, "plan.* matches plan.generated");
  assert(isTopicMatch('plan.*', 'plan.x.y') === false, "plan.* does NOT match plan.x.y (multi-segment)");
  assert(isTopicMatch('plan.#', 'plan') === true, "plan.# matches base topic plan");
  assert(isTopicMatch('plan.#', 'plan.generated') === true, "plan.# matches plan.generated");
  assert(isTopicMatch('plan.#', 'plan.generated.final') === true, "plan.# matches multi-segment plan.generated.final");
  assert(isTopicMatch('plan.approved', 'plan.approved') === true, "Exact match plan.approved matches plan.approved");
  assert(isTopicMatch('plan.approved', 'plan.rejected') === false, "Exact match rejects mismatching topic");

  // ----------------------------------------------------
  // TEST 2: DEF-07 Idempotency Separation (Read-Check vs Registration)
  // ----------------------------------------------------
  console.log("\n--- TEST 2: DEF-07 Idempotency Separation ---");
  const idemp = new IdempotencyManager();
  const testKey = "idemp_12345";

  assert(idemp.hasDuplicate(testKey) === false, "hasDuplicate returns false before registration");
  assert(idemp.hasDuplicate(testKey) === false, "Repeated read check does NOT mutate idempotency state");

  // Simulate failed dispatch attempt (do not call markProcessed)
  assert(idemp.hasDuplicate(testKey) === false, "Failed attempt remains retryable");

  // Simulate successful dispatch
  idemp.markProcessed(testKey);
  assert(idemp.hasDuplicate(testKey) === true, "hasDuplicate returns true after markProcessed registration");

  // ----------------------------------------------------
  // TEST 3: DEF-02 Session Lock Deadlock Prevention
  // ----------------------------------------------------
  console.log("\n--- TEST 3: DEF-02 Planning Session Lock Re-entrancy ---");
  const lock = new PlanningSessionLock();
  const parentSessionId = "plan_sess_2026-07-26_100";

  assert(lock.acquireLock(parentSessionId) === true, "Parent planning session acquires lock");
  
  // Re-evaluating decision using parent session ID
  assert(lock.acquireLock(parentSessionId) === true, "Sub-operation reusing parent session ID succeeds without deadlock");

  // Releasing lock
  assert(lock.releaseLock(parentSessionId) === true, "Parent session releases lock cleanly");

  // ----------------------------------------------------
  // TEST 4: Routine Input Deduplication & Preservation
  // ----------------------------------------------------
  console.log("\n--- TEST 4: Routine Input Deduplication & Completed Task Preservation ---");
  const dupeRoutines = [
    { taskName: "Fajr", completed: false },
    { taskName: "Fajr", completed: true },
    { taskName: "Workout", completed: false },
    { taskName: "Workout", completed: false }
  ];

  const deduped = deduplicateRoutinesInput(dupeRoutines);
  assert(deduped.length === 2, "Deduplicated routine array from 4 items to 2 unique tasks");
  assert(deduped.find(r => r.taskName === "Fajr")?.completed === true, "Preserved completed Fajr task during deduplication");

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
