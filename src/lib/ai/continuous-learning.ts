import { db } from '@/lib/db';
import type { AILearningRecord } from './types';

class ContinuousLearningEngine {
  /**
   * Adjusts local recommendation preference weights based on user interactions
   */
  async recordFeedback(category: string, action: 'accepted' | 'completed' | 'dismissed'): Promise<void> {
    const existing = await db.aiLearning.get(category);
    let weight = existing ? existing.weight : 1.0;
    let conversionRate = existing?.conversionRate ?? 0.5;

    if (action === 'accepted' || action === 'completed') {
      weight = Math.min(2.0, parseFloat((weight + 0.1).toFixed(2)));
      conversionRate = Math.min(1.0, parseFloat((conversionRate + 0.05).toFixed(2)));
    } else if (action === 'dismissed') {
      weight = Math.max(0.2, parseFloat((weight - 0.15).toFixed(2)));
      conversionRate = Math.max(0.0, parseFloat((conversionRate - 0.05).toFixed(2)));
    }

    const record: AILearningRecord = {
      key: category,
      category,
      weight,
      conversionRate,
      updatedAt: Date.now()
    };

    await db.aiLearning.put(record);
  }

  /**
   * Evaluates prediction accuracy against actual logged outcomes (MAE error calculation)
   */
  async recordPredictionAccuracy(metric: string, predictedVal: number, actualVal: number): Promise<void> {
    const mae = Math.abs(predictedVal - actualVal);
    const existing = await db.aiLearning.get(`pred_mae_${metric}`);
    const prevMae = existing?.maeError ?? mae;
    const updatedMae = parseFloat(((prevMae * 0.7) + (mae * 0.3)).toFixed(2));

    const record: AILearningRecord = {
      key: `pred_mae_${metric}`,
      category: 'prediction_accuracy',
      weight: 1.0,
      maeError: updatedMae,
      updatedAt: Date.now()
    };

    await db.aiLearning.put(record);
  }

  /**
   * Retrieves active learning weight vector for prompt / recommendation prioritization
   */
  async getLearningWeights(): Promise<Record<string, number>> {
    const records = await db.aiLearning.toArray();
    const weights: Record<string, number> = {};

    for (const r of records) {
      weights[r.key] = r.weight;
    }

    return weights;
  }
}

export const continuousLearningEngine = new ContinuousLearningEngine();
