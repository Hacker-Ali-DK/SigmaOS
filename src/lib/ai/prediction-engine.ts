import { db } from '@/lib/db';
import { calculateScoresForDate } from '@/lib/scoring/scoring-service';
import type { PredictionVector } from './types';

/**
 * Executes historical time-series forecasting across 7 core metrics.
 */
export async function generatePredictions(selectedDate: string): Promise<PredictionVector> {
  const dopamineUrges = await db.dopamineUrges.toArray();
  const routines = await db.routines.toArray();
  const goals = await db.goals.toArray();
  const userProfile = (await db.userProfile.toArray())[0];
  const prayerLogs = await db.prayers.toArray();

  // 1. Recovery Score Prediction (Exponential smoothing)
  const currentScores = await calculateScoresForDate(selectedDate);
  // Uses deterministic scoring based on the day's alignment. Only predict if data exists.
  const recoveryScorePred = currentScores.overallAlignment > 0 
    ? Math.min(100, Math.max(0, Math.round(currentScores.overallAlignment * 0.95 + 3)))
    : null;

  // 2. Energy Prediction Curve (24-hour circadian curve)
  const todaySleep = await db.sleep.get(selectedDate);
  let energyCurve: Array<{ hour: number; level: number }> | null = null;
  
  if (todaySleep) {
    const sleepHrs = todaySleep.totalHours;
    const sleepPenalty = sleepHrs < 7 ? (7 - sleepHrs) * 8 : 0;
  
    energyCurve = Array.from({ length: 24 }, (_, hour) => {
      let baseEnergy = 50;
      if (hour >= 7 && hour <= 12) baseEnergy = 85 - (hour - 7) * 3;
      else if (hour >= 13 && hour <= 15) baseEnergy = 60; // post-prandial dip
      else if (hour >= 16 && hour <= 19) baseEnergy = 75 - (hour - 16) * 4;
      else if (hour >= 20 || hour <= 6) baseEnergy = 30;
  
      const adjustedLevel = Math.max(10, Math.min(100, Math.round(baseEnergy - sleepPenalty)));
      return { hour, level: adjustedLevel };
    });
  }

  // 3. Relapse Risk Prediction (Heuristic Risk Score)
  const cleanStreak = userProfile?.cleanStreak ?? 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recentHighUrges = dopamineUrges.filter(u => (now - u.timestamp <= 2 * dayMs) && u.strength === 'high').length;
  
  let relapseRisk = 15; // baseline heuristic low
  if (cleanStreak <= 3) relapseRisk += 40; // Critical Phase (Days 1-3)
  if (recentHighUrges > 0) relapseRisk += recentHighUrges * 20;
  if (todaySleep && todaySleep.totalHours < 6) relapseRisk += 15;
  relapseRisk = Math.min(95, Math.max(5, relapseRisk));

  // 4. Burnout Index Prediction
  let burnoutIndex: number | null = null;
  const totalRoutines = routines.filter(r => r.date === selectedDate).length;
  if (totalRoutines > 0) {
    const completedRoutines = routines.filter(r => r.date === selectedDate && r.completed).length;
    const routineRatio = completedRoutines / totalRoutines;
    // Fix: higher routine ratio -> higher burnout. 
    burnoutIndex = Math.min(100, Math.max(5, Math.round(routineRatio * 40 + ((todaySleep && todaySleep.totalHours < 6) ? 30 : 0) + 15)));
  }

  // 5. Sleep Quality Prediction (Upcoming night rating 1-5)
  let sleepQualityPred: number | null = null;
  if (todaySleep) {
    const sleepHrs = todaySleep.totalHours;
    if (sleepHrs < 6) sleepQualityPred = 2;
    else if (sleepHrs < 7) sleepQualityPred = 3;
    else if (sleepHrs >= 8) sleepQualityPred = 5;
    else sleepQualityPred = 4;
  }

  // 6. Prayer Consistency Prediction
  let prayerConsistencyPred: Record<string, number> | null = null;
  if (prayerLogs.length >= 3) {
    const counts = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
    const isOnTime = (val: any) => {
      if (val === 'prayed_on_time' || val === true) return true;
      if (typeof val === 'object' && val !== null && 'status' in val) return val.status === 'prayed_on_time';
      return false;
    };
    prayerLogs.forEach(p => {
      if (isOnTime(p.fajr)) counts.fajr++;
      if (isOnTime(p.dhuhr)) counts.dhuhr++;
      if (isOnTime(p.asr)) counts.asr++;
      if (isOnTime(p.maghrib)) counts.maghrib++;
      if (isOnTime(p.isha)) counts.isha++;
    });
    prayerConsistencyPred = {
      fajr: Math.round((counts.fajr / prayerLogs.length) * 100),
      dhuhr: Math.round((counts.dhuhr / prayerLogs.length) * 100),
      asr: Math.round((counts.asr / prayerLogs.length) * 100),
      maghrib: Math.round((counts.maghrib / prayerLogs.length) * 100),
      isha: Math.round((counts.isha / prayerLogs.length) * 100)
    };
  }

  // 7. Goal Completion Prediction
  const goalCompletionPred = goals.length > 0 ? goals.map(g => {
    const isCompleted = g.completed || g.currentValue >= g.targetValue;
    return {
      goalId: g.id || 0,
      title: g.title,
      predictedCompletionDate: isCompleted ? 'Completed' : 'Insufficient trend data',
      onTrack: isCompleted || (g.currentValue / Math.max(1, g.targetValue)) >= 0.5
    };
  }) : null;

  return {
    recoveryScorePred,
    energyCurve,
    relapseRisk,
    burnoutIndex,
    sleepQualityPred,
    prayerConsistencyPred,
    goalCompletionPred,
    timestamp: Date.now()
  };
}
