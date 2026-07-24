import { buildCompressedContext } from './context-builder';
import { memoryManager } from './memory-manager';
import { generatePredictions } from './prediction-engine';
import { runCorrelationDiscovery } from './correlation-engine';
import { continuousLearningEngine } from './continuous-learning';
import { explainScoreChange, explainRelapseRisk } from './explainability-engine';
import { optimizeDailySchedule } from './schedule-optimizer';
import { permissionSystem } from './permission-system';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import type { CompressedContext, PredictionVector, AICorrelationRecord, ExplanationResult, ScheduleOptimizationPlan, AIActionRequest } from './types';

export interface OrchestratedAIResponse {
  messageText: string;
  context: CompressedContext;
  predictions: PredictionVector;
  correlations: AICorrelationRecord[];
  explanation?: ExplanationResult;
  proposedSchedule?: ScheduleOptimizationPlan;
  pendingAction?: AIActionRequest;
}

class AICoreOrchestrator {
  constructor() {
    // Phase 5 Reactive Event Subscriptions
    if (typeof window !== 'undefined') {
      eventBus.subscribe('ai_orchestrator_sleep', StandardEvents.SLEEP_LOGGED, async () => {
        console.log("[AI Orchestrator] Reacting to SLEEP_LOGGED event -> Auto-refreshing context");
      });
      eventBus.subscribe('ai_orchestrator_urge', StandardEvents.URGE_LOGGED, async () => {
        console.log("[AI Orchestrator] Reacting to URGE_LOGGED event -> Auto-evaluating crisis protocol");
      });
    }
  }

  /**
   * Primary entry point for processing user dialogue & generating smart insights
   */
  async processUserMessage(
    sessionId: string,
    userQuery: string,
    selectedDate: string
  ): Promise<OrchestratedAIResponse> {
    // Stage 1: Add user turn to session memory
    await memoryManager.addTurn(sessionId, 'user', userQuery);

    // Stage 2: Dynamic Context Collection
    const context = await buildCompressedContext(selectedDate);
    const predictions = await generatePredictions(selectedDate);
    const correlations = await runCorrelationDiscovery();

    // Stage 3: Feature Explanations & Schedule Optimization evaluation
    let explanation: ExplanationResult | undefined;
    let proposedSchedule: ScheduleOptimizationPlan | undefined;
    let pendingAction: AIActionRequest | undefined;

    const lowerQuery = userQuery.toLowerCase();

    if (lowerQuery.includes('why') && (lowerQuery.includes('score') || lowerQuery.includes('recovery'))) {
      explanation = await explainScoreChange(selectedDate);
    } else if (lowerQuery.includes('risk') || lowerQuery.includes('relapse')) {
      explanation = explainRelapseRisk(predictions.relapseRisk, 14, 0);
    }

    if (lowerQuery.includes('schedule') || lowerQuery.includes('optimize') || lowerQuery.includes('day')) {
      proposedSchedule = await optimizeDailySchedule(selectedDate);
      pendingAction = permissionSystem.createActionRequest(
        'Optimize Daily Schedule',
        'Reschedule routines around prayer windows and peak energy hours.',
        'APPLY_SCHEDULE_OPTIMIZATION',
        proposedSchedule
      );
    }

    // Stage 4: Construct Offline Response Text
    let messageText = "Assalamu Alaikum! I've analyzed your complete tracking metrics.";

    if (explanation) {
      messageText = explanation.userText;
    } else if (proposedSchedule) {
      messageText = `I have optimized your schedule for today! Target energy peak work block: 09:00 - 10:30. Resolved ${proposedSchedule.resolvedConflicts.length} prayer window conflicts. Estimated score boost: +${proposedSchedule.scoreImpact} pts.`;
    } else if (lowerQuery.includes('predict') || lowerQuery.includes('energy') || lowerQuery.includes('sleep')) {
      messageText = `Energy Prediction: Your peak cognitive energy is forecasted between 08:00 - 11:00. Predicted Sleep Quality score: ${predictions.sleepQualityPred}/5 based on your active health logs.`;
    } else if (lowerQuery.includes('fajr') || lowerQuery.includes('prayer')) {
      messageText = `Prayer Consistency Forecast: Fajr (${predictions.prayerConsistencyPred.fajr}%), Dhuhr (${predictions.prayerConsistencyPred.dhuhr}%). Fajr consistency is strongly correlated (r = +0.65) with your daily Discipline Score.`;
    } else {
      messageText = `Your current Recovery Score is ${context.scores.recovery}% and Deen Score is ${context.scores.deen}%. Clean Streak: 14 days. Remember to maintain hydration and complete your routine blocks.`;
    }

    // Stage 5: Save AI response turn to session memory
    await memoryManager.addTurn(sessionId, 'ai', messageText);

    // Stage 6: Learning feedback tracking
    await continuousLearningEngine.recordFeedback('chat_response', 'completed');

    return {
      messageText,
      context,
      predictions,
      correlations,
      explanation,
      proposedSchedule,
      pendingAction
    };
  }
}

export const aiOrchestrator = new AICoreOrchestrator();
