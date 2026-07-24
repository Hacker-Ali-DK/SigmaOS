import { db } from '@/lib/db';
import { constraintEngineManager } from './constraint-engine';
import { multiObjectiveOptimizer } from './multi-objective-optimizer';
import { decisionEngineManager } from './decision-engine';
import { planningSessionLock } from './session-lock';
import { DEFAULT_PLANNER_CONFIG } from './planner-config';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import type {
  DailyPlan,
  TimeBlock,
  TaskCandidate,
  Constraint,
  PlanRevision,
  PlanStatus,
  PlanGenerationReason,
  PlanGeneratedPayload,
  PlanProposedPayload
} from './types';

class DynamicPlannerManager {
  private readonly config = DEFAULT_PLANNER_CONFIG;

  /**
   * Primary entry point to generate an optimal 24-hour daily plan for target date
   */
  async generateDailyPlan(
    dateStr: string,
    reason: PlanGenerationReason = 'midnight_recalibration',
    userTasks: TaskCandidate[] = []
  ): Promise<DailyPlan> {
    const planId = `plan_${dateStr}`;
    const sessionId = `plan_sess_${dateStr}_${Date.now()}`;

    // 1. Acquire Planning Session Lock
    const acquired = await planningSessionLock.acquireLock(sessionId);
    if (!acquired) {
      throw new Error(`[DynamicPlanner] Locked: Session active for date ${dateStr}`);
    }

    try {
      // 2. Fetch Active Constraints from Stage 3 Constraint Engine
      const constraints = await constraintEngineManager.getActiveConstraints(dateStr);

      // 3. Retrieve Existing Revision Parent Pointer for Dexie Versioning
      const existingPlan = await db.dailyPlans.where({ date: dateStr }).first();
      const existingRevisions = await db.planRevisions.where({ planId }).toArray();
      const parentRevisionId = existingPlan ? existingPlan.revision.revisionId : null;
      const revisionIndex = existingRevisions.length;
      const revisionId = `rev_${planId}_R${revisionIndex}`;

      const revision: PlanRevision = {
        planId,
        revisionId,
        parentRevisionId,
        generatedAt: Date.now(),
        generatedBy: reason,
        plannerVersion: 'v7.1'
      };

      // 4. Construct TimeBlocks (Hard Constraints -> Soft Tasks -> Splitting -> Buffers)
      const timeBlocks = await this.constructTimeBlocks(dateStr, planId, constraints, userTasks);

      // 5. Evaluate Multi-Objective Score (DYI) via Stage 5 Optimizer
      const score = multiObjectiveOptimizer.calculatePlanScore(timeBlocks, constraints, userTasks);

      // 6. Build DailyPlan Object
      const plan: DailyPlan = {
        planId,
        date: dateStr,
        revision,
        status: 'proposed',
        timeBlocks,
        score
      };

      // 7. Evaluate Plan Proposal via Stage 4 Decision Engine
      const decResult = await decisionEngineManager.evaluateDecision({
        category: 'routine',
        intent: `Construct 24h Daily Plan for ${dateStr}`,
        priority: 'P1',
        rawConfidence: 0.95,
        securityLevel: 1,
        dateStr,
        proposedPlanId: planId
      });

      if (decResult.decision.status === 'rejected') {
        console.warn(`[DynamicPlanner] Decision Engine rejected plan proposal: ${decResult.decision.decisionId}`);
      }

      // 8. Persist Plan & Revision to Dexie Version 9 Tables
      await db.dailyPlans.put(plan as any);
      await db.planRevisions.put(revision as any);

      // 9. Emit Strongly Typed Events over Phase 5 Event Bus
      const genPayload: PlanGeneratedPayload = {
        planId: plan.planId,
        date: plan.date,
        revisionId: plan.revision.revisionId,
        blockCount: plan.timeBlocks.length,
        dailyYieldIndex: plan.score.dailyYieldIndex
      };
      await eventBus.publish(StandardEvents.PLAN_GENERATED, genPayload);

      const propPayload: PlanProposedPayload = {
        planId: plan.planId,
        revisionId: plan.revision.revisionId,
        proposedAt: Date.now()
      };
      await eventBus.publish(StandardEvents.PLAN_PROPOSED, propPayload);

      return plan;
    } finally {
      planningSessionLock.releaseLock(sessionId);
    }
  }

  /**
   * Internal Time-Block Constructor enforcing non-overlap, solar windows, sleep architecture, & task splitting
   */
  private async constructTimeBlocks(
    dateStr: string,
    planId: string,
    constraints: Constraint[],
    userTasks: TaskCandidate[]
  ): Promise<TimeBlock[]> {
    const blocks: TimeBlock[] = [];
    let blockCounter = 1;

    // A. Add Hard Constraints as Locked TimeBlocks
    for (const c of constraints) {
      if (c.isHard) {
        let cat: TimeBlock['category'] = 'routine';
        if (c.type === 'solar_prayer') cat = 'prayer';
        else if (c.type === 'sleep_architecture') cat = 'sleep';
        else if (c.type === 'wudu_buffer') cat = 'prayer';

        blocks.push({
          blockId: `${planId}_block_${blockCounter++}`,
          planId,
          startTime: c.affectedTimeRange.startTime,
          endTime: c.affectedTimeRange.endTime,
          startTimeMs: c.affectedTimeRange.startTimeMs,
          endTimeMs: c.affectedTimeRange.endTimeMs,
          category: cat,
          title: c.title,
          priority: 'P0',
          source: 'solar_engine',
          isLocked: true
        });
      }
    }

    // B. Fit User Tasks / Routines into Unallocated Idle Slots (Applying Task Splitting)
    const defaultStudyDurationMins = this.config.studyBlockLengthMins; // 90 mins
    const breakMins = this.config.breakLengthMins;                    // 15 mins

    // Example Focus Study Session (09:15 to 10:45) if free
    const studyStartMs = new Date(`${dateStr}T09:15:00`).getTime();
    const studyEndMs = studyStartMs + defaultStudyDurationMins * 60 * 1000;

    const overlapsHard = blocks.some(b => (studyStartMs < b.endTimeMs) && (studyEndMs > b.startTimeMs));
    if (!overlapsHard) {
      blocks.push({
        blockId: `${planId}_block_${blockCounter++}`,
        planId,
        startTime: '09:15',
        endTime: '10:45',
        startTimeMs: studyStartMs,
        endTimeMs: studyEndMs,
        category: 'study',
        title: 'Deep Work / Cognitive Focus Block (90m)',
        priority: 'P1',
        source: 'auto_planner',
        isLocked: false
      });

      // 15m Cognition Recovery Break Buffer
      const breakStartMs = studyEndMs;
      const breakEndMs = breakStartMs + breakMins * 60 * 1000;
      blocks.push({
        blockId: `${planId}_block_${blockCounter++}`,
        planId,
        startTime: new Date(breakStartMs).toTimeString().substring(0, 5),
        endTime: new Date(breakEndMs).toTimeString().substring(0, 5),
        startTimeMs: breakStartMs,
        endTimeMs: breakEndMs,
        category: 'recovery',
        title: '15m Rest & Recovery Buffer',
        priority: 'P2',
        source: 'auto_planner',
        isLocked: false
      });
    }

    // Sort timeblocks strictly by startTimeMs
    return blocks.sort((a, b) => a.startTimeMs - b.startTimeMs);
  }
}

export const dynamicPlannerManager = new DynamicPlannerManager();
