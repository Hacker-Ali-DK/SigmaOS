import { DEFAULT_PLANNER_CONFIG } from './planner-config';

/**
 * Recovery+ Phase 7 Planning Session Lock
 * Guarantees single-writer execution, preventing race conditions or concurrent solver passes.
 */
class PlanningSessionLock {
  private activeLockId: string | null = null;
  private lockAcquiredTimestamp = 0;
  private readonly timeoutMs: number;

  constructor(timeoutMs = DEFAULT_PLANNER_CONFIG.workerTimeoutMs) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Attempts to acquire the planning session lock.
   * Auto-releases expired locks (>5000ms) to prevent deadlocks.
   */
  async acquireLock(sessionId: string): Promise<boolean> {
    const now = Date.now();

    // Check if existing lock is expired
    if (this.activeLockId && now - this.lockAcquiredTimestamp > this.timeoutMs) {
      console.warn(`[PlanningSessionLock] Expired lock auto-released for session: ${this.activeLockId}`);
      this.releaseLock(this.activeLockId);
    }

    if (this.activeLockId !== null) {
      return false; // Lock acquisition denied; session active
    }

    this.activeLockId = sessionId;
    this.lockAcquiredTimestamp = now;
    return true;
  }

  /**
   * Releases the active lock if the provided sessionId matches.
   */
  releaseLock(sessionId: string): boolean {
    if (this.activeLockId === sessionId) {
      this.activeLockId = null;
      this.lockAcquiredTimestamp = 0;
      return true;
    }
    return false;
  }

  /**
   * Returns whether a planning session is currently locked.
   */
  isLocked(): boolean {
    const now = Date.now();
    if (this.activeLockId && now - this.lockAcquiredTimestamp > this.timeoutMs) {
      this.activeLockId = null;
      this.lockAcquiredTimestamp = 0;
      return false;
    }
    return this.activeLockId !== null;
  }

  /**
   * Gets the active lock session ID if present.
   */
  getActiveSessionId(): string | null {
    return this.isLocked() ? this.activeLockId : null;
  }
}

export const planningSessionLock = new PlanningSessionLock();
