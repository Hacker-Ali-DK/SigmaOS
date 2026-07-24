/**
 * Recovery+ Architecture Phase 4 & 4A TypeScript Interfaces
 * Defines context, memory, predictions, correlations, continuous learning,
 * explainability, schedule optimization, confidence, and action permission models.
 */

export interface ChatMessageRecord {
  id?: number;
  sessionId: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AIMemoryRecord {
  key: string;
  category: 'preference' | 'fact' | 'summary';
  value: string;
  confidence: number; // 0 to 1
  updatedAt: number;
}

export interface AICorrelationRecord {
  pairKey: string; // e.g. "sleep_energy"
  moduleA: string;
  moduleB: string;
  correlation: number; // -1.0 to 1.0
  pValue: number; // Statistical significance
  relationship: 'strong_positive' | 'moderate_positive' | 'weak' | 'moderate_negative' | 'strong_negative';
  sampleSize: number;
  updatedAt: number;
}

export interface AILearningRecord {
  key: string;
  weight: number;
  category: string;
  conversionRate?: number;
  maeError?: number;
  updatedAt: number;
}

export interface PredictionVector {
  recoveryScorePred: number;
  energyCurve: Array<{ hour: number; level: number }>; // 0-23 hours, 0-100 energy level
  relapseRisk: number; // 0-100 scale
  burnoutIndex: number; // 0-100 scale
  sleepQualityPred: number; // 1-5 rating scale
  prayerConsistencyPred: Record<string, number>; // fajr, dhuhr, asr, maghrib, isha on-time prob %
  goalCompletionPred: Array<{ goalId: number; title: string; predictedCompletionDate: string; onTrack: boolean }>;
  confidenceScores: Record<string, number>; // Domain -> confidence score %
  timestamp: number;
}

export interface FeatureAttribution {
  feature: string;
  weight: number;
  impactPoints: number;
}

export interface AuditTrace {
  targetMetric: string;
  netDelta: number;
  attributions: FeatureAttribution[];
  ruleTriggered?: string;
  confidenceScore: number;
}

export interface ExplanationResult {
  explanationId: string;
  timestamp: number;
  userText: string;
  auditTrace: AuditTrace;
}

export interface ScheduleConstraint {
  id: string;
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isHard: boolean; // True for solar prayers, wudu, fixed commitments
  category: 'prayer' | 'wudu' | 'sleep' | 'fixed' | 'workout' | 'study' | 'habit';
}

export interface ScheduleOptimizationPlan {
  planId: string;
  proposedEvents: ScheduleConstraint[];
  resolvedConflicts: string[];
  scoreImpact: number; // Estimated + Recovery delta
}

export type ActionSecurityLevel = 1 | 2 | 3 | 4;

export interface AIActionRequest {
  id: string;
  title: string;
  description: string;
  actionType: string;
  securityLevel: ActionSecurityLevel;
  securityLabel: 'Automatic' | 'Confirmation Required' | 'Restricted' | 'Never Automatic';
  payload: any;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdAt: number;
}

export interface CompressedContext {
  solarWindow: string;
  scores: {
    deen: number;
    recovery: number;
    discipline: number;
  };
  deenMetrics: string;
  recoveryMetrics: string;
  sleepMetrics: string;
  confidence: 'Complete' | 'Partial';
  predictionsSummary?: string;
  correlationsSummary?: string;
}
