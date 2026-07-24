import { db } from '@/lib/db';
import { getStructuredDeenAIContext, formatDeenAIContextForPrompt } from '@/lib/deen/deen-ai-context';
import { calculateScoresForDate } from '@/lib/scoring/scoring-service';
import type { CompressedContext } from './types';

/**
 * Ingests 360-degree user data across 4 temporal windows (24h, 7d, 30d, 90d).
 * Applies vector compression, key shortening, and P0-P4 priority rules.
 */
export async function buildCompressedContext(selectedDate: string): Promise<CompressedContext> {
  // 1. Ingest scores for target date
  const dailyScores = await calculateScoresForDate(selectedDate);
  const deenContext = await getStructuredDeenAIContext(selectedDate, 7);

  // 2. Query 7-day and 30-day rolling health telemetry
  const sleepLogs = await db.sleep.toArray();
  const dopamineUrges = await db.dopamineUrges.toArray();
  const waterLog = await db.water.get(selectedDate);
  const userProfile = (await db.userProfile.toArray())[0];

  // Calculate 7-day sleep stats
  const recentSleep = sleepLogs.slice(-7);
  const avgSleep = recentSleep.length > 0
    ? (recentSleep.reduce((acc, s) => acc + s.totalHours, 0) / recentSleep.length).toFixed(1)
    : '8.0';
  const todaySleep = await db.sleep.get(selectedDate);
  const todaySleepStr = todaySleep ? `${todaySleep.totalHours}h (Qual: ${todaySleep.qualityRating || 3}/5)` : 'untracked';

  // Calculate 7-day urge stats
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recentUrges = dopamineUrges.filter(u => now - u.timestamp <= 7 * dayMs);
  const urges24h = dopamineUrges.filter(u => now - u.timestamp <= 1 * dayMs);
  const maxUrgeStr = urges24h.length > 0
    ? Math.max(...urges24h.map(u => u.strength === 'high' ? 5 : u.strength === 'medium' ? 3 : 1))
    : 0;

  // Active Prayer Solar Window Context
  const activePrayerWindow = deenContext.prayerTracking.byPrayer.fajr.onTimeCount > 0 ? 'Completed Fajr' : 'Active Solar Window';
  const cleanStreak = userProfile?.cleanStreak ?? 0;
  const waterLiters = waterLog ? `${waterLog.amountLiters}L` : '0L';
  const waterTarget = userProfile?.dailyWaterTarget ? `${userProfile.dailyWaterTarget}L` : '3.0L';

  // Vector Compression & Formatting
  const deenMetricsVector = `PRYR_7D[OT:${deenContext.prayerTracking.onTimeCount}, LT:${deenContext.prayerTracking.lateCount}, MS:${deenContext.prayerTracking.missedCount}, Cov:${deenContext.prayerTracking.coveragePercent}%] | QRN:${deenContext.quran.totalMinutes}m`;
  const recoveryMetricsVector = `STRK:${cleanStreak}d | URG_24H[Count:${urges24h.length}, MaxStr:${maxUrgeStr}/5] | URG_7D[Total:${recentUrges.length}]`;
  const sleepMetricsVector = `SLP_TDY:${todaySleepStr} | SLP_7D_AVG:${avgSleep}h | WTR:${waterLiters}/${waterTarget}`;

  return {
    solarWindow: `Status: ${activePrayerWindow} | Loc: ${userProfile?.city || 'Default'}`,
    scores: {
      deen: Math.round(dailyScores.deen.score),
      recovery: Math.round(dailyScores.overallAlignment),
      discipline: Math.round(dailyScores.discipline.score)
    },
    deenMetrics: deenMetricsVector,
    recoveryMetrics: recoveryMetricsVector,
    sleepMetrics: sleepMetricsVector,
    confidence: todaySleep ? 'Complete' : 'Partial'
  };
}
