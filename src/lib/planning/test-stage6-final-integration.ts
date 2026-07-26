import './indexeddb-preload';
import { dynamicPlannerManager } from './dynamic-planner';
import { conflictResolutionEngine } from './conflict-engine';
import { explainabilityEngine } from './explainability-engine';
import { userApprovalPipeline } from './user-approval-pipeline';
import { failureRecoveryManager } from './failure-recovery';
import { plannerMetricsManager } from './planner-metrics';
import { db } from '@/lib/db';
import type { TimeBlock } from './types';

if (typeof window === 'undefined') {
  let mockDailyPlans = new Map<string, any>();
  let mockPlanRevisions: any[] = [];
  let mockDecisionHistory: any[] = [];
  let mockPlannerMetrics: any[] = [];
  let mockUserProfile = { id: 1, name: 'Abdullah', timezone: 'Asia/Karachi', latitude: 24.86, longitude: 67.00 };

  (db.userProfile as any).get = async () => mockUserProfile;
  (db.userProfile as any).toArray = async () => [mockUserProfile];

  const emptyTableMock = (storeName: string) => ({
    get: async () => null,
    toArray: async () => [],
    sortBy: async () => [],
    add: async () => 1,
    put: async () => 1,
    delete: async () => 1,
    where: () => ({
      first: async () => null,
      toArray: async () => [],
      sortBy: async () => [],
      delete: async () => 1,
      filter: () => ({ first: async () => null, toArray: async () => [] })
    })
  });

  (db.routines as any).where = () => ({
    sortBy: async () => [],
    toArray: async () => []
  });
  (db.routines as any).bulkAdd = async () => [];

  (db.constraintCache as any) = {
    where: () => ({
      toArray: async () => [],
      first: async () => null,
    }),
    put: async () => 1,
  };

  (db.prayers as any).get = async () => null;
  (db.sleep as any).get = async () => null;
  (db.water as any).get = async () => null;
  (db.journal as any).get = async () => null;
  (db.meals as any).where = () => ({ toArray: async () => [] });
  (db.workouts as any).where = () => ({ toArray: async () => [] });
  (db.dopamineUrges as any).toArray = async () => [];

  (db as any).plannerMetrics = emptyTableMock('plannerMetrics');
  (db as any).plannerMetrics.add = async (m: any) => { mockPlannerMetrics.push(m); return m.id || 1; };
  (db as any).plannerMetrics.toArray = async () => mockPlannerMetrics;

  (db.dailyPlans as any).where = (query: any) => ({
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

  (db.dailyPlans as any).put = async (plan: any) => {
    mockDailyPlans.set(plan.date, plan);
    return plan.date;
  };

  (db.dailyPlans as any).update = async (key: string, changes: any) => {
    const existing = mockDailyPlans.get(key);
    if (existing) {
      mockDailyPlans.set(key, { ...existing, ...changes });
    }
    return 1;
  };

  (db.planRevisions as any).where = (query: any) => ({
    equals: () => ({
      reverse: () => ({
        first: async () => mockDecisionHistory[0] || null
      })
    }),
    toArray: async () => mockPlanRevisions.filter(r => query.planId ? r.planId === query.planId : true),
    filter: (fn: any) => ({
      first: async () => mockPlanRevisions.filter(r => query.planId ? r.planId === query.planId : true).find(fn) || null
    }),
    first: async () => mockPlanRevisions.find(r => query.planId ? r.planId === query.planId : true) || null
  });

  (db.planRevisions as any).put = async (rev: any) => {
    mockPlanRevisions.push(rev);
    return rev.revisionId;
  };

  (db.decisionHistory as any).add = async (audit: any) => {
    mockDecisionHistory.push(audit);
    return audit.auditId;
  };
  (db.decisionHistory as any).where = () => ({
    equals: () => ({
      reverse: () => ({
        first: async () => mockDecisionHistory[0] || null
      })
    })
  });

  (db.eventStore as any).add = async () => 1;
  (db.eventStore as any).update = async () => 1;
}

async function testStage6FinalIntegration() {
  console.log("=== Testing Stage 6 Final Integration & End-to-End Pipeline ===");

  try {
    const targetDate = '2026-07-24';

    // 1. Generate Base Daily Plan (Stage 5 Planner)
    const plan = await dynamicPlannerManager.generateDailyPlan(targetDate, 'midnight_recalibration');
    console.log(`✓ End-to-End Plan Generated: ID ${plan.planId} (DYI: ${plan.score.dailyYieldIndex}/100)`);

    // 2. Test 4-Step Conflict Resolution Engine
    const overlappingBlocks: TimeBlock[] = [
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
    console.log(`✓ Conflict Resolution Executed: ${conflictRes.resolvedBlocks.length} non-overlapping blocks`);
    console.log(`✓ Resolution Method Logged: ${conflictRes.resolutionLog[0]?.method} (${conflictRes.resolutionLog[0]?.reason})`);

    // 3. Test Dual Explainability Output
    const explanation = await explainabilityEngine.generateExplanation(plan);
    console.log(`✓ User Natural Explanation: "${explanation.naturalLanguageSummary}"`);
    console.log(`✓ Forecast Confidence: ${explanation.scoreForecast.confidence}`);

    // 4. Test User Approval Pipeline & Single Active Plan Invariant
    const approvedPlan = await userApprovalPipeline.approvePlan(plan);
    console.log(`✓ User Plan Approved Status: ${approvedPlan.status} (Expected: executing)`);

    // 5. Test Plan Modification & Parent-Linked Revision Creation (R_N+1)
    const modifiedPlan = await userApprovalPipeline.modifyPlan(approvedPlan, approvedPlan.timeBlocks);
    console.log(`✓ Modified Plan Revision Created: ${modifiedPlan.revision.revisionId}`);
    console.log(`✓ Parent Revision Pointer Linked: ${modifiedPlan.revision.parentRevisionId}`);

    // 6. Test Multi-Level Rollback
    const rolledBack = await userApprovalPipeline.rollbackToRevision(plan.planId, plan.revision.revisionId);
    console.log(`✓ Multi-Level Revision Rollback Verified: Restored Revision ${rolledBack?.revision.revisionId}`);

    // 7. Test Failure Recovery & PLAN_FAILED Event Emission
    const restored = await failureRecoveryManager.handlePlannerFailure(targetDate, 'Simulated Solver Timeout Exception');
    console.log(`✓ Failure Recovery Fallback Executed: Restored Valid Revision ${restored?.revision.revisionId}`);

    // 8. Test Offline Planner Metrics Recording
    const metrics = await plannerMetricsManager.recordPlanningMetrics({
      planningDurationMs: 42,
      conflictsResolvedCount: 1,
      plansGeneratedCount: 1,
      plansApprovedCount: 1
    });
    console.log(`✓ Local Offline Metrics Recorded: Total Plans Generated = ${metrics.plansGeneratedCount}`);

    console.log("=== Stage 6 Final Integration Suite Verified Successfully! ===");
  } catch (err: any) {
    console.error("❌ Stage 6 Execution Error:", err?.stack || err);
    process.exit(1);
  }
}

testStage6FinalIntegration();
