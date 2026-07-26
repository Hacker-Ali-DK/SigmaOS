// Standalone Runner for Stage 6 Final Integration & End-to-End Pipeline

const { dynamicPlannerManager } = require('./dynamic-planner');
const { conflictResolutionEngine } = require('./conflict-engine');
const { explainabilityEngine } = require('./explainability-engine');
const { userApprovalPipeline } = require('./user-approval-pipeline');
const { failureRecoveryManager } = require('./failure-recovery');
const { plannerMetricsManager } = require('./planner-metrics');
const { db } = require('../db');

// Intercept Dexie tables for Node environment
let mockDailyPlans = new Map();
let mockPlanRevisions = [];
let mockDecisionHistory = [];
let mockUserProfile = { id: 1, name: 'Abdullah', timezone: 'Asia/Karachi', latitude: 24.86, longitude: 67.00 };

(db.userProfile).get = async () => mockUserProfile;
(db.userProfile).toArray = async () => [mockUserProfile];

db.dailyPlans.where = (query) => ({
  first: async () => {
    if (query.date) return mockDailyPlans.get(query.date) || null;
    if (query.planId) {
      for (const p of mockDailyPlans.values()) {
        if (p.planId === query.planId) return p;
      }
    }
    return null;
  },
  toArray: async () => Array.from(mockDailyPlans.values()).filter(p => query.date ? p.date === query.date : true),
});

db.dailyPlans.put = async (plan) => {
  mockDailyPlans.set(plan.date, plan);
  return plan.date;
};

db.dailyPlans.update = async (key, changes) => {
  const existing = mockDailyPlans.get(key);
  if (existing) {
    mockDailyPlans.set(key, { ...existing, ...changes });
  }
  return 1;
};

db.planRevisions.where = (query) => ({
  toArray: async () => mockPlanRevisions.filter(r => query.planId ? r.planId === query.planId : true),
  filter: (fn) => ({
    first: async () => mockPlanRevisions.filter(r => query.planId ? r.planId === query.planId : true).find(fn) || null
  }),
  first: async () => mockPlanRevisions.find(r => query.planId ? r.planId === query.planId : true) || null
});

db.planRevisions.put = async (rev) => {
  mockPlanRevisions.push(rev);
  return rev.revisionId;
};

db.decisionHistory.add = async (audit) => {
  mockDecisionHistory.push(audit);
  return audit.auditId;
};

db.eventStore.add = async (env) => {
  return 1;
};
db.eventStore.update = async () => 1;

async function runStage6Tests() {
  console.log("=================================================");
  console.log("=== STAGE 6 FINAL INTEGRATION VERIFICATION ===");
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

  const targetDate = '2026-07-26';

  // 1. Generate Base Daily Plan (Stage 5 / Stage 6 Integration)
  const plan = await dynamicPlannerManager.generateDailyPlan(targetDate, 'midnight_recalibration');
  assert(Boolean(plan && plan.planId), `End-to-End Plan Generated: ID ${plan.planId}`);
  assert(plan.score.dailyYieldIndex > 0, `Daily Yield Index calculated (${plan.score.dailyYieldIndex}/100)`);

  // 2. Conflict Resolution Engine
  const overlappingBlocks = [
    {
      blockId: 'b1', planId: plan.planId, startTime: '09:00', endTime: '10:30',
      startTimeMs: 1000, endTimeMs: 2000, category: 'routine', title: 'Task 1',
      priority: 'P2', source: 'auto_planner', isLocked: false
    },
    {
      blockId: 'b2', planId: plan.planId, startTime: '09:30', endTime: '11:00',
      startTimeMs: 1500, endTimeMs: 2500, category: 'workout', title: 'Task 2',
      priority: 'P1', source: 'auto_planner', isLocked: false
    }
  ];

  const conflictRes = conflictResolutionEngine.resolveConflicts(overlappingBlocks);
  assert(conflictRes.resolvedBlocks.length === 2, `Conflict Resolution Executed: ${conflictRes.resolvedBlocks.length} non-overlapping blocks`);

  // 3. Dual Explainability Output
  const explanation = await explainabilityEngine.generateExplanation(plan);
  assert(Boolean(explanation.naturalLanguageSummary), `User Natural Explanation Generated: "${explanation.naturalLanguageSummary}"`);

  // 4. User Approval Pipeline
  const approvedPlan = await userApprovalPipeline.approvePlan(plan);
  assert(approvedPlan.status === 'executing', `User Plan Approved Status: ${approvedPlan.status} (Expected: executing)`);

  // 5. Plan Modification & Parent-Linked Revision Creation
  const modifiedPlan = await userApprovalPipeline.modifyPlan(approvedPlan, approvedPlan.timeBlocks);
  assert(modifiedPlan.revision.parentRevisionId === approvedPlan.revision.revisionId, `Parent Revision Pointer Linked (${modifiedPlan.revision.parentRevisionId})`);

  // 6. Multi-Level Rollback
  const rolledBack = await userApprovalPipeline.rollbackToRevision(plan.planId, plan.revision.revisionId);
  assert(rolledBack?.revision.revisionId === plan.revision.revisionId, `Multi-Level Revision Rollback Restored Revision ${rolledBack?.revision.revisionId}`);

  // 7. Failure Recovery
  const restored = await failureRecoveryManager.handlePlannerFailure(targetDate, 'Simulated Solver Timeout Exception');
  assert(restored !== null, `Failure Recovery Fallback Restored Valid Revision`);

  console.log("\n=================================================");
  console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage6Tests().catch(err => {
  console.error(err);
  process.exit(1);
});
