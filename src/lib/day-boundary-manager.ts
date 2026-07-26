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
   * Finalizes previous day clean streak and updates userProfile and goals
   */
  async finalizeCleanStreak(previousDate: string, currentDate: string): Promise<number> {
    const profile = await db.userProfile.get(1);
    if (!profile) return 0;

    const datesToFinalize: string[] = [];
    let curr = new Date(previousDate);
    const end = new Date(currentDate);

    while (curr < end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      datesToFinalize.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }

    let streak = profile.cleanStreak ?? 0;

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
    }

    await db.userProfile.update(1, { cleanStreak: streak });

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

      if (this.activeTodayDate === null) {
        // Initial startup registration
        this.activeTodayDate = currentTodayDate;
        await ensureRoutinesForDate(currentTodayDate);
      } else if (this.activeTodayDate !== currentTodayDate) {
        console.log(`[DayBoundaryManager] Midnight Day Boundary Shift Detected: ${this.activeTodayDate} -> ${currentTodayDate} (Timezone: ${tz})`);

        const previousDate = this.activeTodayDate;
        this.activeTodayDate = currentTodayDate;

        // 1. Finalize clean streak for completed previous day(s)
        await this.finalizeCleanStreak(previousDate, currentTodayDate);

        // 2. Ensure routines exist for the new date
        await ensureRoutinesForDate(currentTodayDate);

        // 3. If user was viewing yesterday's "today", seamlessly transition UI to new date
        const store = useAppStore.getState();
        if (store.selectedDate === previousDate) {
          store.setSelectedDate(currentTodayDate);
        }

        // 4. Recalibrate Phase 6 Notification Engine for new solar day
        await notificationSchedulingEngine.recalibrateSolarSchedules(currentTodayDate);

        // 5. Trigger Phase 7 Dynamic Daily Planner for new day
        await dynamicPlannerManager.generateDailyPlan(currentTodayDate, 'midnight_recalibration');

        // 6. Emit DAY_CHANGED Event to Event Bus
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
