import { DEFAULT_PLANNER_CONFIG } from './planner-config';
import { backgroundPlanningQueue, type QueuedPlanningTask } from './background-queue';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import { getTodayDateString } from '@/lib/store';
import type { PlanGenerationReason, TaskPriority } from './types';

class PlanningTriggerCoordinator {
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingTriggers: Map<string, { priority: TaskPriority; reason: PlanGenerationReason; events: string[] }> = new Map();
  private readonly debounceWindowMs: number;

  constructor(debounceWindowMs = DEFAULT_PLANNER_CONFIG.debounceWindowMs) {
    this.debounceWindowMs = debounceWindowMs;
    this.initEventBusSubscriptions();
  }

  /**
   * Initializes event listeners on Phase 5 Event Bus
   */
  private initEventBusSubscriptions(): void {
    if (typeof window === 'undefined') return;

    // P0 Urge Trigger -> Immediate Crisis Protocol Planning
    eventBus.subscribe('trigger_coord_urge', StandardEvents.URGE_LOGGED, async () => {
      const todayStr = getTodayDateString();
      this.handleTrigger(todayStr, 'P0', 'crisis_protocol', StandardEvents.URGE_LOGGED);
    });

    // P1 Sleep Logged -> Recalibrate Day Planning
    eventBus.subscribe('trigger_coord_sleep', StandardEvents.SLEEP_LOGGED, async () => {
      const todayStr = getTodayDateString();
      this.handleTrigger(todayStr, 'P1', 'adaptive_reschedule', StandardEvents.SLEEP_LOGGED);
    });

    // P1 Prayer Logged -> Recalibrate Solar Schedule
    eventBus.subscribe('trigger_coord_prayer', StandardEvents.PRAYER_LOGGED, async () => {
      const todayStr = getTodayDateString();
      this.handleTrigger(todayStr, 'P1', 'adaptive_reschedule', StandardEvents.PRAYER_LOGGED);
    });

    // P2 Prediction Updated -> Re-align Energy Curve
    eventBus.subscribe('trigger_coord_pred', StandardEvents.PREDICTION_UPDATED, async () => {
      const todayStr = getTodayDateString();
      this.handleTrigger(todayStr, 'P2', 'adaptive_reschedule', StandardEvents.PREDICTION_UPDATED);
    });
  }

  /**
   * Primary entry point handling incoming trigger requests.
   * P0 Crisis events bypass debouncing and queue immediately.
   * P1/P2 events are debounced for 300ms and batched.
   */
  handleTrigger(date: string, priority: TaskPriority, reason: PlanGenerationReason, eventTopic: string): void {
    if (priority === 'P0') {
      // Immediate Crisis Priority Dispatch
      this.dispatchTask(date, priority, reason, [eventTopic]);
      return;
    }

    // Consolidate pending trigger events for date
    const existing = this.pendingTriggers.get(date) || { priority, reason, events: [] };
    const highestPriority = this.getHigherPriority(existing.priority, priority);
    existing.priority = highestPriority;
    existing.reason = reason;
    if (!existing.events.includes(eventTopic)) {
      existing.events.push(eventTopic);
    }
    this.pendingTriggers.set(date, existing);

    // Debounce for 300ms
    if (this.debounceTimers.has(date)) {
      clearTimeout(this.debounceTimers.get(date)!);
    }

    const timer = setTimeout(() => {
      const pending = this.pendingTriggers.get(date);
      if (pending) {
        this.dispatchTask(date, pending.priority, pending.reason, pending.events);
        this.pendingTriggers.delete(date);
        this.debounceTimers.delete(date);
      }
    }, this.debounceWindowMs);

    this.debounceTimers.set(date, timer);
  }

  private dispatchTask(date: string, priority: TaskPriority, reason: PlanGenerationReason, events: string[]): void {
    const task: QueuedPlanningTask = {
      taskId: `task_${date}_${Date.now()}`,
      date,
      priority,
      reason,
      queuedTimestamp: Date.now(),
      payload: { events },
      execute: async () => {
        console.log(`[PlanningTriggerCoordinator] Executing consolidated plan run for date ${date} (Priority: ${priority}, Events: ${events.join(', ')})`);
      }
    };

    backgroundPlanningQueue.enqueue(task);
  }

  private getHigherPriority(p1: TaskPriority, p2: TaskPriority): TaskPriority {
    const weights: Record<TaskPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return weights[p1] <= weights[p2] ? p1 : p2;
  }
}

export const planningTriggerCoordinator = new PlanningTriggerCoordinator();
