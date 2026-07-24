import { db } from '@/lib/db';
import { calculatePrayerTimes } from '@/lib/deen/prayer-engine';
import type { ScheduledReminderRecord } from './types';

class NotificationSchedulingEngine {
  /**
   * Executes Midnight Solar Recalibration Pass for next 24-hour prayer reminders
   */
  async recalibrateSolarSchedules(selectedDate: string): Promise<void> {
    const userProfile = (await db.userProfile.toArray())[0];
    const dateObj = new Date(selectedDate);

    const prayerTimes = calculatePrayerTimes({
      date: dateObj,
      latitude: userProfile?.latitude ?? 24.8607,
      longitude: userProfile?.longitude ?? 67.0011,
      timezone: userProfile?.timezone ?? 'Asia/Karachi',
      method: userProfile?.prayerMethod ?? 'karachi',
      asrMethod: userProfile?.asrMethod ?? 'standard',
      ishaPolicy: userProfile?.ishaPolicy ?? 'fajr'
    });

    // Clear stale solar schedules
    await db.scheduledReminders.where({ isSolarDependent: true as any }).delete();

    const solarReminders: ScheduledReminderRecord[] = [
      {
        reminderId: `fajr_${selectedDate}`,
        category: 'prayer',
        triggerTimestamp: new Date(`${selectedDate}T${prayerTimes.fajr}:00`).getTime(),
        priority: 'P1',
        title: 'Fajr Prayer Window Open',
        body: 'Fajr prayer time has arrived. Start your day in remembrance.',
        isSolarDependent: true,
        status: 'pending'
      },
      {
        reminderId: `dhuhr_${selectedDate}`,
        category: 'prayer',
        triggerTimestamp: new Date(`${selectedDate}T${prayerTimes.dhuhr}:00`).getTime(),
        priority: 'P1',
        title: 'Dhuhr Prayer Window Open',
        body: 'Dhuhr prayer time has arrived.',
        isSolarDependent: true,
        status: 'pending'
      },
      {
        reminderId: `asr_${selectedDate}`,
        category: 'prayer',
        triggerTimestamp: new Date(`${selectedDate}T${prayerTimes.asr}:00`).getTime(),
        priority: 'P1',
        title: 'Asr Prayer Window Open',
        body: 'Asr prayer time has arrived.',
        isSolarDependent: true,
        status: 'pending'
      },
      {
        reminderId: `maghrib_${selectedDate}`,
        category: 'prayer',
        triggerTimestamp: new Date(`${selectedDate}T${prayerTimes.maghrib}:00`).getTime(),
        priority: 'P1',
        title: 'Maghrib Prayer Window Open',
        body: 'Maghrib prayer time has arrived.',
        isSolarDependent: true,
        status: 'pending'
      },
      {
        reminderId: `isha_${selectedDate}`,
        category: 'prayer',
        triggerTimestamp: new Date(`${selectedDate}T${prayerTimes.isha}:00`).getTime(),
        priority: 'P1',
        title: 'Isha Prayer Window Open',
        body: 'Isha prayer time has arrived.',
        isSolarDependent: true,
        status: 'pending'
      }
    ];

    for (const item of solarReminders) {
      if (!isNaN(item.triggerTimestamp)) {
        await db.scheduledReminders.add(item);
      }
    }
  }

  /**
   * Startup recovery routine: Scans scheduledReminders for expired offline triggers
   */
  async performStartupCatchupSweep(): Promise<void> {
    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    // Ingest all pending reminders whose triggerTimestamp has passed
    const expiredPending = await db.scheduledReminders
      .where('triggerTimestamp')
      .below(now)
      .filter(r => r.status === 'pending')
      .toArray();

    for (const item of expiredPending) {
      const isP0OrPrayer = item.priority === 'P0' || item.category === 'prayer';

      if (isP0OrPrayer) {
        if (item.triggerTimestamp >= fourHoursAgo) {
          // Immediately generate catch-up notification
          const { notificationEngine } = await import('./notification-engine');
          await notificationEngine.dispatchNotification({
            id: `${item.reminderId}_catchup`,
            category: item.category,
            priority: item.priority,
            title: `[Catch-up] ${item.title}`,
            body: item.body,
            timestamp: now
          });
        }
        // Mark as processed
        if (item.id) await db.scheduledReminders.update(item.id, { status: 'cancelled' });
      } else if (item.priority === 'P1') {
        if (item.triggerTimestamp >= twoHoursAgo) {
          // Reschedule for 15 minutes from now if still meaningful
          if (item.id) {
            await db.scheduledReminders.update(item.id, {
              triggerTimestamp: now + 15 * 60 * 1000,
              status: 'pending'
            });
          }
        } else {
          if (item.id) await db.scheduledReminders.update(item.id, { status: 'cancelled' });
        }
      } else {
        // P2/P3 older than 2 hours: silently expire/remove
        if (item.id) await db.scheduledReminders.delete(item.id);
      }
    }
  }
}

export const notificationSchedulingEngine = new NotificationSchedulingEngine();
