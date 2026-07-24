/**
 * Multi-Factor Confidence Calculation Engine
 * Formula: C = F_completeness * F_sample_size * F_stability * F_recency
 */
export function calculateConfidence(
  loggedFields: number,
  requiredFields: number,
  sampleSize: number,
  variance: number,
  lastLogDaysAgo: number
): { confidenceScore: number; label: 'High Confidence' | 'Moderate Confidence' | 'Learning' | 'Insufficient Data'; isSurfaced: boolean } {
  // 1. Completeness Factor (0 - 1.0)
  const fCompleteness = requiredFields > 0 ? Math.min(1.0, loggedFields / requiredFields) : 0.5;

  // 2. Sample Size Factor (Logarithmic scaling, min 1.0 at N=30)
  const fSampleSize = Math.min(1.0, Math.log(Math.max(1, sampleSize)) / Math.log(30));

  // 3. Stability Factor (Inverse coefficient of variation)
  const fStability = Math.max(0.2, 1.0 - Math.min(0.8, variance));

  // 4. Recency Factor (Exponential decay half-life of 14 days)
  const fRecency = Math.exp(-0.05 * lastLogDaysAgo);

  const rawScore = fCompleteness * fSampleSize * fStability * fRecency * 100;
  const confidenceScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  let label: 'High Confidence' | 'Moderate Confidence' | 'Learning' | 'Insufficient Data';
  let isSurfaced = false;

  if (confidenceScore >= 85) {
    label = 'High Confidence';
    isSurfaced = true;
  } else if (confidenceScore >= 70) {
    label = 'Moderate Confidence';
    isSurfaced = true;
  } else if (confidenceScore >= 50) {
    label = 'Learning';
    isSurfaced = false;
  } else {
    label = 'Insufficient Data';
    isSurfaced = false;
  }

  return { confidenceScore, label, isSurfaced };
}
