import type { DailyPlan, PlanScore, TimeBlock, TaskCandidate, Constraint } from './types';

class MultiObjectiveOptimizerManager {
  private readonly weights = {
    w1_recovery: 0.30,
    w2_deen: 0.25,
    w3_discipline: 0.15,
    w4_goalPace: 0.10,
    w5_sleepQual: 0.10,
    w6_relapsePenalty: 0.10
  };

  /**
   * Calculates the Multi-Objective PlanScore and Daily Yield Index (DYI) for a candidate plan.
   */
  calculatePlanScore(blocks: TimeBlock[], constraints: Constraint[], tasks: TaskCandidate[]): PlanScore {
    // 1. Deen Sub-Score (Solar prayer coverage)
    const prayerBlocks = blocks.filter(b => b.category === 'prayer');
    const deenSubScore = Math.min(100, Math.round((prayerBlocks.length / 5) * 100));

    // 2. Sleep Quality Sub-Score (Minimum sleep architecture)
    const sleepBlocks = blocks.filter(b => b.category === 'sleep');
    const totalSleepMins = sleepBlocks.reduce((acc, b) => acc + (b.endTimeMs - b.startTimeMs) / 60000, 0);
    const sleepQualitySubScore = Math.min(100, Math.round((totalSleepMins / 360) * 100)); // 360m = 6.0h target

    // 3. Discipline Sub-Score (Routine & task completion efficiency)
    const totalBlocks = blocks.length;
    const disciplineSubScore = totalBlocks > 0 ? Math.min(100, Math.round((totalBlocks / 10) * 100)) : 50;

    // 4. Goal Pace Sub-Score
    const goalBlocks = blocks.filter(b => b.category === 'goal' || b.category === 'study');
    const goalPaceSubScore = Math.min(100, Math.round((goalBlocks.length / 3) * 100));

    // 5. Recovery Sub-Score
    const recoveryBlocks = blocks.filter(b => b.category === 'recovery' || b.category === 'workout' || b.category === 'hydration');
    const recoverySubScore = Math.min(100, Math.round((recoveryBlocks.length / 3) * 100));

    // 6. Relapse Risk Penalty (Penalty if hard constraints are violated or missing rest buffers)
    const hardViolations = constraints.filter(c => c.isHard).some(c => {
      return !blocks.some(b => b.category === 'prayer' || b.category === 'sleep');
    });
    const relapseRiskPenalty = hardViolations ? 30 : 0;

    // 7. Calculate Daily Yield Index (DYI)
    const dyi = Math.round(
      this.weights.w1_recovery * recoverySubScore +
      this.weights.w2_deen * deenSubScore +
      this.weights.w3_discipline * disciplineSubScore +
      this.weights.w4_goalPace * goalPaceSubScore +
      this.weights.w5_sleepQual * sleepQualitySubScore -
      this.weights.w6_relapsePenalty * relapseRiskPenalty
    );

    const dailyYieldIndex = Math.max(0, Math.min(100, dyi));

    return {
      dailyYieldIndex,
      recoverySubScore,
      deenSubScore,
      disciplineSubScore,
      goalPaceSubScore,
      sleepQualitySubScore,
      relapseRiskPenalty
    };
  }

  /**
   * Ranks candidate plans according to Pareto Daily Yield Index (DYI)
   */
  selectBestPlan(candidatePlans: DailyPlan[]): DailyPlan | null {
    if (candidatePlans.length === 0) return null;
    return candidatePlans.sort((a, b) => b.score.dailyYieldIndex - a.score.dailyYieldIndex)[0];
  }
}

export const multiObjectiveOptimizer = new MultiObjectiveOptimizerManager();
