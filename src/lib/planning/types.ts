/**
 * Recovery+ Architecture Phase 7 & 7.1 Core Domain Types & Shared Contracts
 */

// ============================================================================
// ENUMERATIONS
// ============================================================================

export type PlanStatus = 'proposed' | 'approved' | 'rejected' | 'executing' | 'completed' | 'rolled_back';
export type DecisionStatus = 'evaluating' | 'proposed' | 'approved' | 'rejected' | 'executing' | 'completed' | 'rolled_back';
export type ConstraintType = 'solar_prayer' | 'wudu_buffer' | 'sleep_architecture' | 'fixed_appointment' | 'recovery_limit' | 'energy_peak' | 'quiet_hours' | 'workload_cap';
export type ConstraintSeverity = 'hard' | 'soft';
export type TaskCategory = 'prayer' | 'routine' | 'workout' | 'hydration' | 'meal' | 'sleep' | 'goal' | 'recovery' | 'study' | 'ai';
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type EnergyLevel = 'peak' | 'high' | 'medium' | 'low' | 'depleted';
export type PlanGenerationReason = 'midnight_recalibration' | 'user_request' | 'adaptive_reschedule' | 'crisis_protocol';
export type PlannerMode = 'balanced' | 'spiritual_focus' | 'recovery_focus' | 'exam_prep';
export type BlockSource = 'auto_planner' | 'user_manual' | 'solar_engine' | 'crisis_protocol';
export type ConflictResolutionMethod = 'priority_override' | 'task_split' | 'slot_shift' | 'task_defer';
export type LearningSource = 'plan_approval' | 'plan_rejection' | 'manual_modification' | 'duration_error';
export type ApprovalState = 'pending' | 'accepted' | 'rejected' | 'modified' | 'rolled_back';
export type AuditSeverity = 'info' | 'warning' | 'critical';
export type EventPriority = 'P0' | 'P1' | 'P2' | 'P3';

// ============================================================================
// CORE DOMAIN INTERFACES
// ============================================================================

export interface PlanRevision {
  readonly planId: string;
  readonly revisionId: string;
  readonly parentRevisionId: string | null;
  readonly generatedAt: number;
  readonly generatedBy: PlanGenerationReason;
  readonly plannerVersion: string;
}

export interface PlanScore {
  readonly dailyYieldIndex: number;
  readonly recoverySubScore: number;
  readonly deenSubScore: number;
  readonly disciplineSubScore: number;
  readonly goalPaceSubScore: number;
  readonly sleepQualitySubScore: number;
  readonly relapseRiskPenalty: number;
}

export interface TimeBlock {
  readonly blockId: string;
  readonly planId: string;
  readonly startTime: string;   // ISO HH:MM format
  readonly endTime: string;     // ISO HH:MM format
  readonly startTimeMs: number; // Unix epoch ms for fast interval math
  readonly endTimeMs: number;   // Unix epoch ms for fast interval math
  readonly category: TaskCategory;
  readonly title: string;
  readonly priority: TaskPriority;
  readonly source: BlockSource;
  readonly isLocked: boolean;
  readonly taskId?: string;
  readonly subTaskIndex?: number;
  readonly completionTimestamp?: number;
  readonly actualDurationMinutes?: number;
}

export interface DailyPlan {
  readonly planId: string;
  readonly date: string; // YYYY-MM-DD
  readonly revision: PlanRevision;
  readonly status: PlanStatus;
  readonly timeBlocks: TimeBlock[];
  readonly score: PlanScore;
  readonly rejectionReason?: string;
  readonly userNotes?: string;
}

export interface TaskCandidate {
  readonly taskId: string;
  readonly category: TaskCategory;
  readonly title: string;
  readonly preferredDurationMinutes: number;
  readonly priority: TaskPriority;
  readonly energyRequirement: EnergyLevel;
  readonly deadlineTimestamp?: number;
  readonly preferredTimeRange?: { startTime: string; endTime: string };
  readonly splitAllowed?: boolean;
  readonly minSplitDurationMinutes?: number;
}

export interface Constraint {
  readonly constraintId: string;
  readonly type: ConstraintType;
  readonly severity: ConstraintSeverity;
  readonly title: string;
  readonly affectedTimeRange: { startTime: string; endTime: string; startTimeMs: number; endTimeMs: number };
  readonly isHard: boolean;
  readonly penaltyWeight?: number;
  readonly ruleIdentifier?: string;
  readonly metadata?: Record<string, any>;
}

export interface Decision {
  readonly decisionId: string;
  readonly category: TaskCategory;
  readonly intent: string;
  readonly priority: TaskPriority;
  readonly confidenceScore: number;
  readonly status: DecisionStatus;
  readonly securityLevel: number; // Level 1 to 4
  readonly targetBlockId?: string;
  readonly proposedPlanId?: string;
}

export interface DecisionAudit {
  readonly auditId: string;
  readonly decisionId: string;
  readonly timestamp: number;
  readonly confidenceScore: number;
  readonly rulesFired: string[];
  readonly constraintsEvaluated: string[];
  readonly rejectedAlternatives: Array<{
    readonly alternativeId: string;
    readonly description: string;
    readonly rejectionReason: string;
  }>;
  readonly executionDurationMs: number;
  readonly plannerVersion: string;
  readonly solverSeed?: string;
  readonly diagnosticLogs?: string[];
}

export interface PlanningContext {
  readonly contextId: string;
  readonly date: string;
  readonly userProfile: Record<string, any>;
  readonly solarTimes: Record<string, string>;
  readonly predictions: Record<string, number>;
  readonly activeTasks: TaskCandidate[];
  readonly activeConstraints: Constraint[];
  readonly recentUrges?: Record<string, any>[];
  readonly recentNotifications?: Record<string, any>[];
}

export interface PlannerConfig {
  readonly minimumConfidence: number;         // e.g. 0.75 (75%)
  readonly debounceWindowMs: number;          // e.g. 300ms
  readonly maximumPlanningTimeMs: number;     // e.g. 5000ms
  readonly studyBlockLengthMins: number;      // e.g. 90 mins
  readonly breakLengthMins: number;           // e.g. 15 mins
  readonly minimumSleepHours: number;         // e.g. 6.0 hours
  readonly prayerBufferMins: number;          // e.g. 15 mins
  readonly workerTimeoutMs: number;           // e.g. 5000ms
  readonly revisionLimitPerDay: number;       // e.g. 10 revisions
  readonly learningRate: number;              // e.g. 0.05
}

export interface PlanningMetrics {
  readonly metricsId: string;
  readonly timestamp: number;
  readonly planningDurationMs: number;
  readonly optimizationDurationMs: number;
  readonly conflictsResolvedCount: number;
  readonly plansGeneratedCount: number;
  readonly plansApprovedCount: number;
  readonly plansRejectedCount: number;
  readonly averageConfidenceScore: number;
  readonly rescheduleCount: number;
}

export interface DomainPlannerPlugin {
  readonly id: string;
  readonly domain: string;
  getConstraints(date: string): Promise<Constraint[]>;
  getTaskCandidates(date: string): Promise<TaskCandidate[]>;
  evaluateImpact(plan: DailyPlan): Promise<Record<string, number>>;
}

// ============================================================================
// EVENT PAYLOAD INTERFACES
// ============================================================================

export interface PlanGeneratedPayload {
  readonly planId: string;
  readonly date: string;
  readonly revisionId: string;
  readonly blockCount: number;
  readonly dailyYieldIndex: number;
}

export interface PlanApprovedPayload {
  readonly planId: string;
  readonly revisionId: string;
  readonly approvedAt: number;
}

export interface PlanProposedPayload {
  readonly planId: string;
  readonly revisionId: string;
  readonly proposedAt: number;
}

export interface PlanFailedPayload {
  readonly planId: string;
  readonly date: string;
  readonly errorMessage: string;
  readonly fallbackRevisionId: string;
}

export interface PlanRescheduledPayload {
  readonly planId: string;
  readonly revisionId: string;
  readonly triggerReason: string;
  readonly timestamp: number;
  readonly modifiedBlockIds: string[];
}

export interface DecisionEvaluatedPayload {
  readonly decisionId: string;
  readonly intent: string;
  readonly confidenceScore: number;
  readonly auditId: string;
}
