import { db } from '@/lib/db';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import type {
  DailyPlan,
  PlanRevision,
  PlanApprovedPayload,
  PlanRescheduledPayload
} from './types';

class UserApprovalPipelineManager {
  /**
   * User Approves Proposed DailyPlan: Sets status to 'executing' and enforces single active executing plan
   */
  async approvePlan(plan: DailyPlan): Promise<DailyPlan> {
    // Enforce single active executing plan per date: Mark all prior plans for date as completed or rolled_back
    const existing = await db.dailyPlans.where({ date: plan.date }).toArray();
    for (const p of existing) {
      if (p.planId !== plan.planId && p.status === 'executing') {
        await db.dailyPlans.update(p.date, { status: 'completed' });
      }
    }

    const approvedPlan: DailyPlan = {
      ...plan,
      status: 'executing'
    };

    // Update in Dexie db.dailyPlans
    await db.dailyPlans.put(approvedPlan as any);

    // Emit PLAN_APPROVED event to Event Bus
    const payload: PlanApprovedPayload = {
      planId: approvedPlan.planId,
      revisionId: approvedPlan.revision.revisionId,
      approvedAt: Date.now()
    };
    await eventBus.publish(StandardEvents.PLAN_APPROVED, payload);

    return approvedPlan;
  }

  /**
   * User Rejects Proposed DailyPlan: Sets status to 'rejected'
   */
  async rejectPlan(plan: DailyPlan, reason?: string): Promise<DailyPlan> {
    const rejectedPlan: DailyPlan = {
      ...plan,
      status: 'rejected',
      rejectionReason: reason || 'User declined proposed plan'
    };

    await db.dailyPlans.put(rejectedPlan as any);

    await eventBus.publish(StandardEvents.PLAN_REJECTED, {
      planId: rejectedPlan.planId,
      revisionId: rejectedPlan.revision.revisionId,
      proposedAt: Date.now()
    });

    return rejectedPlan;
  }

  /**
   * User Modifies Plan: Creates a new parent-linked revision (R_N+1) and updates schedule blocks
   */
  async modifyPlan(currentPlan: DailyPlan, modifiedBlocks: DailyPlan['timeBlocks']): Promise<DailyPlan> {
    const revisions = await db.planRevisions.where({ planId: currentPlan.planId }).toArray();
    const revisionIndex = revisions.length;
    const revisionId = `rev_${currentPlan.planId}_R${revisionIndex}`;

    const newRevision: PlanRevision = {
      planId: currentPlan.planId,
      revisionId,
      parentRevisionId: currentPlan.revision.revisionId,
      generatedAt: Date.now(),
      generatedBy: 'adaptive_reschedule',
      plannerVersion: 'v7.1'
    };

    const modifiedPlan: DailyPlan = {
      ...currentPlan,
      revision: newRevision,
      timeBlocks: modifiedBlocks,
      status: 'executing'
    };

    // Persist new revision & updated plan to Dexie
    await db.planRevisions.put(newRevision as any);
    await db.dailyPlans.put(modifiedPlan as any);

    const payload: PlanRescheduledPayload = {
      planId: modifiedPlan.planId,
      revisionId: newRevision.revisionId,
      triggerReason: 'user_manual_modification',
      timestamp: Date.now(),
      modifiedBlockIds: modifiedBlocks.map(b => b.blockId)
    };
    await eventBus.publish(StandardEvents.PLAN_RESCHEDULED, payload);

    return modifiedPlan;
  }

  /**
   * Rollback to Target Revision: Traverses revision chain and restores target plan state
   */
  async rollbackToRevision(planId: string, targetRevisionId: string): Promise<DailyPlan | null> {
    const targetRev = await db.planRevisions.where({ planId }).filter(r => r.revisionId === targetRevisionId).first();
    if (!targetRev) {
      console.warn(`[UserApprovalPipeline] Revision ${targetRevisionId} not found for plan ${planId}`);
      return null;
    }

    const plan = await db.dailyPlans.where({ planId }).first();
    if (!plan) return null;

    const rolledBackPlan: DailyPlan = {
      ...plan,
      revision: targetRev,
      status: 'executing'
    };

    await db.dailyPlans.put(rolledBackPlan as any);
    return rolledBackPlan;
  }
}

export const userApprovalPipeline = new UserApprovalPipelineManager();
