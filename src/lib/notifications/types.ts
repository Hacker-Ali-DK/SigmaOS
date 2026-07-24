/**
 * Recovery+ Architecture Phase 6 Smart Notification TypeScript Definitions
 */

export type ReminderCategory =
  | 'prayer'
  | 'routine'
  | 'workout'
  | 'hydration'
  | 'meal'
  | 'sleep'
  | 'goal'
  | 'recovery'
  | 'ai';

export type NotificationPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface NotificationPayload {
  id: string;
  category: ReminderCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  icon?: string;
  targetTab?: string;
  actionButtons?: Array<{
    actionKey: 'complete' | 'snooze' | 'skip' | 'reschedule';
    label: string;
  }>;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface ScheduledReminderRecord {
  id?: number;
  reminderId: string;
  category: ReminderCategory;
  triggerTimestamp: number;
  priority: NotificationPriority;
  title: string;
  body: string;
  cronExpression?: string;
  isSolarDependent?: boolean;
  status: 'pending' | 'triggered' | 'snoozed' | 'cancelled';
}

export interface NotificationHistoryRecord {
  id?: number;
  reminderId: string;
  category: ReminderCategory;
  timestamp: number;
  userAction: 'delivered' | 'completed' | 'snoozed' | 'skipped' | 'rescheduled' | 'dismissed';
}

export interface NotificationSink {
  id: string;
  dispatch(notification: NotificationPayload): Promise<boolean>;
}
