import { db } from '@/lib/db';
import type { AICorrelationRecord } from './types';

/**
 * Calculates Pearson r correlation coefficient between two numeric arrays
 */
function calculatePearsonR(x: number[], y: number[]): { r: number; pValue: number } {
  const n = x.length;
  if (n < 3) return { r: 0, pValue: 1.0 };

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (den === 0) return { r: 0, pValue: 1.0 };
  const r = Math.max(-1, Math.min(1, num / den));

  // Approximate t-statistic for p-value estimation
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r + 1e-9));
  const pValue = t > 2.1 ? 0.03 : t > 1.8 ? 0.07 : 0.25; // Simple approximation threshold

  return { r: parseFloat(r.toFixed(2)), pValue };
}

/**
 * Classifies correlation strength & direction
 */
function classifyRelationship(r: number): AICorrelationRecord['relationship'] {
  if (r >= 0.6) return 'strong_positive';
  if (r >= 0.3) return 'moderate_positive';
  if (r <= -0.6) return 'strong_negative';
  if (r <= -0.3) return 'moderate_negative';
  return 'weak';
}

/**
 * Runs correlation discovery across tracking modules and saves verified pairs to db.aiCorrelations
 */
export async function runCorrelationDiscovery(): Promise<AICorrelationRecord[]> {
  const sleepLogs = await db.sleep.toArray();
  const dopamineUrges = await db.dopamineUrges.toArray();

  const correlations: AICorrelationRecord[] = [];

  // Pair 1: Sleep Duration vs Quality Rating
  if (sleepLogs.length >= 5) {
    const hours = sleepLogs.map(s => s.totalHours);
    const ratings = sleepLogs.map(s => s.qualityRating || (s.totalHours >= 7 ? 4 : 2));
    const { r, pValue } = calculatePearsonR(hours, ratings);

    if (pValue < 0.05 && Math.abs(r) >= 0.3) {
      const rec: AICorrelationRecord = {
        pairKey: 'sleep_quality',
        moduleA: 'Sleep Duration',
        moduleB: 'Sleep Quality Rating',
        correlation: r,
        pValue,
        relationship: classifyRelationship(r),
        sampleSize: sleepLogs.length,
        updatedAt: Date.now()
      };
      correlations.push(rec);
      await db.aiCorrelations.put(rec);
    }
  }

  return correlations;
}
