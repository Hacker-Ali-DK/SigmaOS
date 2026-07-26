import { db } from '@/lib/db';
import { useAppStore, getTodayDateString, ensureRoutinesForDate } from '@/lib/store';
import { notificationSchedulingEngine } from '@/lib/notifications/scheduling-engine';
import { dynamicPlannerManager } from '@/lib/planning/dynamic-planner';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';

class DayBoundaryManager {
  private checkInterval: NodeJS.Timeout | null = null;
  private activeTodayDate: string | null = null;
  private isInitializing = false;

  /**
   * Initializes the Day-Boundary Manager background service.
   */
  init(): void {
    if (typeof window === 'undefined' || this.checkInterval !== null) return;

    this.checkDayBoundary().catch(console.error);

    // Poll every 10 seconds for midnight day-boundary transitions
    this.checkInterval = setInterval(() => {
      this.checkDayBoundary().catch(console.error);
    }, 10000);
  }

  /**
   * Finalizes clean streak for unprocessed dates strictly between lastFinalizedDate and currentDate
   */
  async finalizeCleanStreak(lastFinalizedDate: string, currentDate: string): Promise<number> {
    const profile = await db.userProfile.get(1);
    if (!profile) return 0;

    const tz = profile.timezone || 'Asia/Karachi';
    const datesToFinalize: string[] = [];

    // Parse start date (day after lastFinalizedDate)
    const [startY, startM, startD] = lastFinalizedDate.split('-').map(Number);
    let curr = new Date(Date.UTC(startY, startM - 1, startD));
    curr.setUTCDate(curr.getUTCDate() + 1); // Move to first unfinalized day

    const [endY, endM, endD] = currentDate.split('-').map(Number);
    const endDate = new Date(Date.UTC(endY, endM - 1, endD));

    while (curr < endDate) {
      const y = curr.getUTCFullYear();
      const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
      const d = String(curr.getUTCDate()).padStart(2, '0');
      datesToFinalize.push(`${y}-${m}-${d}`);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    if (datesToFinalize.length === 0) {
      return profile.cleanStreak ?? 0;
    }

    let streak = profile.cleanStreak ?? 0;
    let lastProcessed = lastFinalizedDate;

    for (const dateStr of datesToFinalize) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const startMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      const endMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();

      const urges = await db.dopamineUrges
        .where('timestamp')
        .between(startMs, endMs, true, true)
        .toArray();

      const relapsed = urges.some(u => u.resisted === false);
      if (relapsed) {
        streak = 0;
      } else {
        streak += 1;
      }
      lastProcessed = dateStr;
    }

    await db.userProfile.update(1, { cleanStreak: streak, lastActiveDate: lastProcessed });

    const goals = await db.goals.toArray();
    const cleanStreakGoal = goals.find(g => g.title === "Clean Streak");
    if (cleanStreakGoal && cleanStreakGoal.id) {
      await db.goals.update(cleanStreakGoal.id, {
        currentValue: streak,
        completed: streak >= cleanStreakGoal.targetValue
      });
    }

    return streak;
  }

  /**
   * Core day-boundary transition check
   */
  async checkDayBoundary(): Promise<void> {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      const profile = await db.userProfile.get(1);
      const tz = profile?.timezone || 'Asia/Karachi';
      const currentTodayDate = getTodayDateString(tz);

      let lastFinalizedDate = profile?.lastActiveDate;
      if (!lastFinalizedDate) {
        lastFinalizedDate = getTodayDateString(tz, -1);
        if (profile) {
          await db.userProfile.update(1, { lastActiveDate: lastFinalizedDate });
        }
      }

      if (this.activeTodayDate === null) {
        // App Startup: Catch up any offline gap days between lastFinalizedDate and currentTodayDate
        this.activeTodayDate = currentTodayDate;
        await ensureRoutinesForDate(currentTodayDate);

        if (lastFinalizedDate < currentTodayDate) {
          await this.finalizeCleanStreak(lastFinalizedDate, currentTodayDate);
        }
      } else if (this.activeTodayDate !== currentTodayDate) {
        console.log(`[DayBoundaryManager] Midnight Day Boundary Shift Detected: ${this.activeTodayDate} -> ${currentTodayDate} (Timezone: ${tz})`);

        const previousDate = this.activeTodayDate;
        this.activeTodayDate = currentTodayDate;

        const startFrom = lastFinalizedDate < previousDate ? lastFinalizedDate : getTodayDateString(tz, -2);
        await this.finalizeCleanStreak(startFrom, currentTodayDate);
        await ensureRoutinesForDate(currentTodayDate);

        const store = useAppStore.getState();
        if (store.selectedDate === previousDate) {
          store.setSelectedDate(currentTodayDate);
        }

        await notificationSchedulingEngine.recalibrateSolarSchedules(currentTodayDate);
        await dynamicPlannerManager.generateDailyPlan(currentTodayDate, 'midnight_recalibration');

        await eventBus.publish(StandardEvents.DAY_CHANGED, {
          previousDate,
          currentDate: currentTodayDate,
          timezone: tz,
          timestamp: Date.now()
        });
      }
    } finally {
      this.isInitializing = false;
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const dayBoundaryManager = new DayBoundaryManager();
