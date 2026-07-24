import { db } from '@/lib/db';
import type { NotificationPayload } from './types';

class IntelligenceRulesManager {
  private readonly maxNonP0Per4Hours = 3;
  private readonly minGapMinutes = 15;

  /**
   * Evaluates candidate notification against anti-spam and rate-limiting rules
   */
  async evaluateNotification(candidate: NotificationPayload): Promise<{ shouldDispatch: boolean; reason?: string; isBannerOnly?: boolean }> {
    // 1. P0 Critical notifications bypass all anti-spam gates
    if (candidate.priority === 'P0') {
      return { shouldDispatch: true };
    }

    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    const fifteenMinsAgo = now - this.minGapMinutes * 60 * 1000;

    // 2. Query recent notification history from IndexedDB
    const recentHistory = await db.notificationHistory
      .where('timestamp')
      .above(fourHoursAgo)
      .toArray();

    // Rate-limiting check: Max 3 non-P0 notifications per 4 hours
    const nonP0Count = recentHistory.filter(h => h.userAction === 'delivered').length;
    if (nonP0Count >= this.maxNonP0Per4Hours) {
      return { shouldDispatch: false, reason: 'Rate limit cap reached (max 3 per 4h)' };
    }

    // Inter-notification gap check: Min 15 minutes between non-P0 alerts
    const lastDelivered = recentHistory.sort((a, b) => b.timestamp - a.timestamp)[0];
    if (lastDelivered && lastDelivered.timestamp > fifteenMinsAgo) {
      return { shouldDispatch: false, reason: 'Minimum 15-minute gap restriction' };
    }

    // In-App Active Visibility check: If user is actively using the app, convert to In-App Banner
    const isAppVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';

    return {
      shouldDispatch: true,
      isBannerOnly: isAppVisible
    };
  }

  /**
   * 30-Day TTL memory pruning for historical notification records only.
   * Executed asynchronously during browser idle time (requestIdleCallback).
   */
  async pruneStaleHistory(): Promise<void> {
    const executeCleanup = async () => {
      try {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        // Strictly deletes only historical notification records; leaves scheduledReminders intact
        await db.notificationHistory.where('timestamp').below(thirtyDaysAgo).delete();
      } catch (err) {
        console.warn('[IntelligenceRules] Idle pruning skipped:', err);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        executeCleanup();
      }, { timeout: 5000 });
    } else {
      setTimeout(executeCleanup, 1000);
    }
  }
}

export const intelligenceRulesManager = new IntelligenceRulesManager();
