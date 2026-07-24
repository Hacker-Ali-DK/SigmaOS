import { db } from '@/lib/db';
import type { PlanningMetrics } from './types';

class PlannerMetricsManager {
  /**
   * Logs local offline diagnostic planning metrics to Dexie db.aiLearning
   */
  async recordPlanningMetrics(delta: Partial<PlanningMetrics>): Promise<PlanningMetrics> {
    const key = 'phase7_planner_metrics';
    const existing = await db.aiLearning.get(key);
    let currentMetrics: PlanningMetrics = existing ? JSON.parse(existing.category || '{}') : {
      metricsId: `metrics_${Date.now()}`,
      timestamp: Date.now(),
      planningDurationMs: 0,
      optimizationDurationMs: 0,
      conflictsResolvedCount: 0,
      plansGeneratedCount: 0,
      plansApprovedCount: 0,
      plansRejectedCount: 0,
      averageConfidenceScore: 0.95,
      rescheduleCount: 0
    };

    currentMetrics = {
      ...currentMetrics,
      timestamp: Date.now(),
      planningDurationMs: delta.planningDurationMs ?? currentMetrics.planningDurationMs,
      optimizationDurationMs: delta.optimizationDurationMs ?? currentMetrics.optimizationDurationMs,
      conflictsResolvedCount: currentMetrics.conflictsResolvedCount + (delta.conflictsResolvedCount || 0),
      plansGeneratedCount: currentMetrics.plansGeneratedCount + (delta.plansGeneratedCount || 0),
      plansApprovedCount: currentMetrics.plansApprovedCount + (delta.plansApprovedCount || 0),
      plansRejectedCount: currentMetrics.plansRejectedCount + (delta.plansRejectedCount || 0),
      rescheduleCount: currentMetrics.rescheduleCount + (delta.rescheduleCount || 0)
    };

    await db.aiLearning.put({
      key,
      weight: currentMetrics.plansGeneratedCount,
      category: JSON.stringify(currentMetrics),
      updatedAt: Date.now()
    });

    return currentMetrics;
  }
}

export const plannerMetricsManager = new PlannerMetricsManager();
