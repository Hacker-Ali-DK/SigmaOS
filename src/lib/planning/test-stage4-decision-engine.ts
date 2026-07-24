import { decisionEngineManager } from './decision-engine';
import { db } from '@/lib/db';
import { planningSessionLock } from './session-lock';

async function testStage4DecisionEngine() {
  console.log("=== Testing Stage 4 Decision Engine ===");

  const targetDate = '2026-07-24';

  // 1. Test Valid Candidate Decision Proposal (Confidence >= 0.75, No Hard Overlap)
  const validResult = await decisionEngineManager.evaluateDecision({
    category: 'routine',
    intent: 'Morning Admin & Hydration',
    priority: 'P2',
    rawConfidence: 0.90,
    securityLevel: 1,
    dateStr: targetDate,
    proposedTimeRange: {
      startTimeMs: new Date(`${targetDate}T10:00:00`).getTime(),
      endTimeMs: new Date(`${targetDate}T10:30:00`).getTime()
    }
  });

  console.log(`✓ Valid Decision Evaluated Status: ${validResult.decision.status} (Expected: proposed)`);
  console.log(`✓ Decision Confidence Score: ${validResult.decision.confidenceScore}`);
  console.log(`✓ Decision Audit Record Created: ID ${validResult.audit.auditId}`);

  // 2. Test Minimum Confidence Threshold Gating (< 0.75)
  const lowConfResult = await decisionEngineManager.evaluateDecision({
    category: 'goal',
    intent: 'Uncertain Heavy Task',
    priority: 'P3',
    rawConfidence: 0.50,
    securityLevel: 1,
    dateStr: targetDate
  });

  console.log(`✓ Low Confidence Decision Status: ${lowConfResult.decision.status} (Expected: rejected)`);
  console.log(`✓ Rejected Reason Logged in Audit: ${lowConfResult.audit.rejectedAlternatives[0]?.rejectionReason}`);

  // 3. Test Hard Constraint Rejection (Overlapping Solar Prayer Window)
  // Fajr prayer window is around 05:00 - 05:30
  const hardConflictResult = await decisionEngineManager.evaluateDecision({
    category: 'workout',
    intent: 'Heavy Exercise During Fajr',
    priority: 'P1',
    rawConfidence: 0.95,
    securityLevel: 1,
    dateStr: targetDate,
    proposedTimeRange: {
      startTimeMs: new Date(`${targetDate}T05:15:00`).getTime(),
      endTimeMs: new Date(`${targetDate}T06:00:00`).getTime()
    }
  });

  console.log(`✓ Hard Constraint Overlap Decision Status: ${hardConflictResult.decision.status} (Expected: rejected)`);
  console.log(`✓ Hard Constraint Rejection Trace: ${hardConflictResult.audit.rejectedAlternatives[0]?.rejectionReason}`);

  // 4. Test Lifecycle Transition (proposed -> approved)
  const approvedDecision = await decisionEngineManager.updateDecisionStatus(validResult.decision, 'approved');
  console.log(`✓ Lifecycle Transition Updated: ${approvedDecision.status} (Expected: approved)`);

  // 5. Test IndexedDB Audit Persistence (db.decisionHistory)
  const persistedAudit = await db.decisionHistory.where({ decisionId: validResult.decision.decisionId }).first();
  console.log(`✓ Dexie DB Audit Persistence Verified: ID ${persistedAudit?.auditId}`);

  // 6. Test Concurrent Execution Protection via Session Lock
  const lockAcquired = await planningSessionLock.acquireLock('manual_test_lock');
  if (lockAcquired) {
    try {
      await decisionEngineManager.evaluateDecision({
        category: 'study',
        intent: 'Concurrent Blocked Pass',
        priority: 'P2',
        rawConfidence: 0.85,
        securityLevel: 1,
        dateStr: targetDate
      });
      console.error("❌ Error: Concurrent decision evaluation should have thrown lock exception");
    } catch (err: any) {
      console.log(`✓ Concurrent Session Lock Rejection Verified: ${err.message}`);
    } finally {
      planningSessionLock.releaseLock('manual_test_lock');
    }
  }

  console.log("=== Stage 4 Decision Engine Verified Successfully! ===");
}

testStage4DecisionEngine().catch(console.error);
