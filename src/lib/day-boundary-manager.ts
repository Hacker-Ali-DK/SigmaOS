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

        // 1. Ensure routines exist for the new date
        await ensureRoutinesForDate(currentTodayDate);

        // 2. If user was viewing yesterday's "today", seamlessly transition UI to new date
        const store = useAppStore.getState();
        if (store.selectedDate === previousDate) {
          store.setSelectedDate(currentTodayDate);
        }

        // 3. Recalibrate Phase 6 Notification Engine for new solar day
        await notificationSchedulingEngine.recalibrateSolarSchedules(currentTodayDate);

        // 4. Trigger Phase 7 Dynamic Daily Planner for new day
        await dynamicPlannerManager.generateDailyPlan(currentTodayDate, 'midnight_recalibration');

        // 5. Emit DAY_CHANGED Event to Event Bus
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
