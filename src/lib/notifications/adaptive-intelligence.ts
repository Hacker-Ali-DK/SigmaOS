import { generatePredictions } from '@/lib/ai/prediction-engine';
import type { NotificationPayload } from './types';

class AdaptiveIntelligenceEngine {
  /**
   * Adapts candidate notification using energy forecasts & relapse risk vectors
   */
  async adaptNotification(candidate: NotificationPayload, targetDate: string): Promise<NotificationPayload> {
    const predictions = await generatePredictions(targetDate);

    // 1. Relapse Risk High -> Upgrade recovery grounding reminders to P0 Critical
    if (predictions.relapseRisk >= 40 && candidate.category === 'recovery') {
      return {
        ...candidate,
        priority: 'P0',
        title: `⚡ Recovery Alert: Gentle Support Needed`,
        body: `Your relapse vulnerability is elevated today. Take 5 deep breaths and focus on Wudu.`
      };
    }

    // 2. Sleep Quality Low -> Shift workout reminder copy to low-intensity recovery walk
    if (predictions.sleepQualityPred <= 2 && candidate.category === 'workout') {
      return {
        ...candidate,
        title: `Light Recovery Walk Suggested`,
        body: `You had lower sleep quality last night. Swap intense exercise for a 20-minute light recovery walk.`
      };
    }

    return candidate;
  }
}

export const adaptiveIntelligenceEngine = new AdaptiveIntelligenceEngine();
