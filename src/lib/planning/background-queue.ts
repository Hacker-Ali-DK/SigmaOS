import type { PlanGenerationReason, TaskPriority } from './types';

export interface QueuedPlanningTask {
  readonly taskId: string;
  readonly date: string; // YYYY-MM-DD
  readonly priority: TaskPriority;
  readonly reason: PlanGenerationReason;
  readonly queuedTimestamp: number;
  readonly payload?: Record<string, any>;
  readonly execute: () => Promise<void>;
}

class BackgroundPlanningQueue {
  private queue: QueuedPlanningTask[] = [];
  private isProcessing = false;

  private readonly priorityWeight: Record<TaskPriority, number> = {
    P0: 0, // Highest priority (Relapse Crisis)
    P1: 1, // Solar shifts, manual user request
    P2: 2, // Standard routine/habit updates
    P3: 3  // Idle background maintenance
  };

  /**
   * Enqueues a planning task into the priority queue.
   * Cancels obsolete tasks for the same target date if new P0/P1 trigger arrives.
   */
  enqueue(task: QueuedPlanningTask): void {
    // Obsolete filter: If new task is higher priority (e.g. P0), cancel lower priority pending tasks for same date
    if (task.priority === 'P0' || task.priority === 'P1') {
      this.queue = this.queue.filter(existing => {
        if (existing.date === task.date && this.priorityWeight[existing.priority] > this.priorityWeight[task.priority]) {
          console.log(`[BackgroundPlanningQueue] Obsolete task ${existing.taskId} cancelled in favor of ${task.taskId}`);
          return false;
        }
        return true;
      });
    }

    this.queue.push(task);

    // Sort queue by priority weight ascending (P0 -> P1 -> P2 -> P3), then FIFO by queuedTimestamp
    this.queue.sort((a, b) => {
      const weightDiff = this.priorityWeight[a.priority] - this.priorityWeight[b.priority];
      if (weightDiff !== 0) return weightDiff;
      return a.queuedTimestamp - b.queuedTimestamp;
    });

    this.processNext();
  }

  /**
   * Processing loop executing tasks from min-heap queue
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();

    if (task) {
      try {
        if (task.priority === 'P3' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          // Defer P3 low-priority tasks to browser idle time
          (window as any).requestIdleCallback(async () => {
            await task.execute();
            this.isProcessing = false;
            this.processNext();
          }, { timeout: 3000 });
          return;
        } else {
          await task.execute();
        }
      } catch (err) {
        console.error(`[BackgroundPlanningQueue] Error executing task ${task.taskId}:`, err);
      }
    }

    this.isProcessing = false;
    this.processNext();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
  }
}

export const backgroundPlanningQueue = new BackgroundPlanningQueue();
