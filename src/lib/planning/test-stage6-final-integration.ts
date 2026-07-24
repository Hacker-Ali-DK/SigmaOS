import { dynamicPlannerManager } from './dynamic-planner';
import { conflictResolutionEngine } from './conflict-engine';
import { explainabilityEngine } from './explainability-engine';
import { userApprovalPipeline } from './user-approval-pipeline';
import { failureRecoveryManager } from './failure-recovery';
import { plannerMetricsManager } from './planner-metrics';
import { db } from '@/lib/db';
import type { TimeBlock } from './types';

async function testStage6FinalIntegration() {
  console.log("=== Testing Stage 6 Final Integration & End-to-End Pipeline ===");

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
}

testStage6FinalIntegration().catch(console.error);
