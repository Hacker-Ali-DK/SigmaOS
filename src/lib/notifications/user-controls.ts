import { db } from '@/lib/db';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import { getTodayDateString } from '@/lib/store';
import type { NotificationPayload } from './types';

class UserControlsManager {
  /**
   * Handles 1-Click Complete directly from notification action button
   */
  async handleComplete(notification: NotificationPayload): Promise<void> {
    const todayStr = getTodayDateString();

    if (notification.category === 'hydration') {
      const existing = await db.water.get(todayStr);
      const current = existing ? existing.amountLiters : 0;
      await db.water.put({ date: todayStr, amountLiters: parseFloat((current + 0.25).toFixed(2)) });
      await eventBus.publish(StandardEvents.WATER_LOGGED, { amountLiters: 0.25 });
    } else if (notification.category === 'routine') {
      await eventBus.publish(StandardEvents.ROUTINE_COMPLETED, { taskName: notification.title });
    }

    await this.logUserAction(notification.id, notification.category, 'completed');
  }

  /**
   * Handles Snooze (defers reminder by specified minutes)
   */
  async handleSnooze(notification: NotificationPayload, minutes = 15): Promise<number> {
    const nextTrigger = Date.now() + minutes * 60 * 1000;
    await db.scheduledReminders.add({
      reminderId: `${notification.id}_snoozed`,
      category: notification.category,
      triggerTimestamp: nextTrigger,
      priority: notification.priority,
      title: notification.title,
      body: `[Snoozed] ${notification.body}`,
      status: 'snoozed'
    });

    await this.logUserAction(notification.id, notification.category, 'snoozed');
    return nextTrigger;
  }

  /**
   * Handles Skip (dismisses current instance without penalty)
   */
  async handleSkip(notification: NotificationPayload): Promise<void> {
    await this.logUserAction(notification.id, notification.category, 'skipped');
  }

  private async logUserAction(reminderId: string, category: NotificationPayload['category'], userAction: 'completed' | 'snoozed' | 'skipped' | 'delivered'): Promise<void> {
    await db.notificationHistory.add({
      reminderId,
      category,
      timestamp: Date.now(),
      userAction
    });
  }
}

export const userControlsManager = new UserControlsManager();
