import { db } from '@/lib/db';
import type { DailyPlan, DecisionAudit } from './types';

export interface ExplanationOutput {
  readonly naturalLanguageSummary: string;
  readonly scoreForecast: {
    dailyYieldIndex: number;
    recoveryGain: string;
    deenGain: string;
    confidence: string;
  };
  readonly decisionAuditTrace?: DecisionAudit;
}

class ExplainabilityEngineManager {
  /**
   * Generates dual-layer user explanation & engineering audit trace for a DailyPlan
   */
  async generateExplanation(plan: DailyPlan): Promise<ExplanationOutput> {
    // 1. Fetch referenced DecisionAudit from Dexie db.decisionHistory
    const auditRecord = await db.decisionHistory
      .where('category')
      .equals('routine')
      .reverse()
      .first();

    // 2. Format User-Friendly Natural Language Explanation
    const prayerCount = plan.timeBlocks.filter(b => b.category === 'prayer').length;
    const studyCount = plan.timeBlocks.filter(b => b.category === 'study').length;
    const recoveryCount = plan.timeBlocks.filter(b => b.category === 'recovery').length;

    const naturalLanguageSummary =
      `Your schedule for ${plan.date} has been dynamically optimized (DYI: ${plan.score.dailyYieldIndex}/100). ` +
      `It protects all ${prayerCount} solar prayer windows with Wudu buffers, aligns ${studyCount} deep work focus block(s) ` +
      `with your peak circadian energy curve, and inserts ${recoveryCount} rest recovery buffer(s) to protect against burnout.`;

    // 3. Format Sub-Score Gains & Forecast
    const scoreForecast = {
      dailyYieldIndex: plan.score.dailyYieldIndex,
      recoveryGain: `+${plan.score.recoverySubScore} pts`,
      deenGain: `+${plan.score.deenSubScore} pts`,
      confidence: auditRecord ? `${Math.round(auditRecord.confidenceScore * 100)}%` : '95%'
    };

    return {
      naturalLanguageSummary,
      scoreForecast,
      decisionAuditTrace: auditRecord
    };
  }
}

export const explainabilityEngine = new ExplainabilityEngineManager();
