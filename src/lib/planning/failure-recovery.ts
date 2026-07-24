import { db } from '@/lib/db';
import { planningSessionLock } from './session-lock';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import type { DailyPlan, PlanFailedPayload } from './types';

class FailureRecoveryManager {
  /**
   * Handles solver / planner execution exceptions safely:
   * Restores last valid plan revision, releases session lock, and emits PLAN_FAILED event.
   */
  async handlePlannerFailure(dateStr: string, errorMessage: string, activeSessionId?: string): Promise<DailyPlan | null> {
    console.error(`[FailureRecovery] Planner execution failed for date ${dateStr}: ${errorMessage}`);

    // 1. Always release session lock if active
    if (activeSessionId) {
      planningSessionLock.releaseLock(activeSessionId);
    }

    const planId = `plan_${dateStr}`;

    // 2. Fetch last valid revision from Dexie db.planRevisions
    const revisions = await db.planRevisions.where({ planId }).toArray();
    const lastValidRev = revisions.length > 0 ? revisions[revisions.length - 1] : null;

    let restoredPlan: DailyPlan | null = null;

    if (lastValidRev) {
      const existingPlan = await db.dailyPlans.where({ date: dateStr }).first();
      if (existingPlan) {
        restoredPlan = {
          ...existingPlan,
          revision: lastValidRev,
          status: 'executing'
        };
        // Restore active plan state in db.dailyPlans
        await db.dailyPlans.put(restoredPlan as any);
        console.log(`[FailureRecovery] Restored last valid plan revision ${lastValidRev.revisionId} for ${dateStr}`);
      }
    }

    // 3. Emit strongly typed PLAN_FAILED Event to Event Bus
    const payload: PlanFailedPayload = {
      planId,
      date: dateStr,
      errorMessage,
      fallbackRevisionId: lastValidRev ? lastValidRev.revisionId : 'none'
    };
    await eventBus.publish(StandardEvents.PLAN_FAILED, payload);

    return restoredPlan;
  }
}

export const failureRecoveryManager = new FailureRecoveryManager();
