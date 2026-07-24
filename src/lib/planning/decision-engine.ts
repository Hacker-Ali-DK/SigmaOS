import { db } from '@/lib/db';
import { constraintEngineManager } from './constraint-engine';
import { planningSessionLock } from './session-lock';
import { DEFAULT_PLANNER_CONFIG } from './planner-config';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import type {
  Decision,
  DecisionAudit,
  DecisionStatus,
  TaskCategory,
  TaskPriority,
  DecisionEvaluatedPayload
} from './types';

export interface CandidateDecisionInput {
  category: TaskCategory;
  intent: string;
  priority: TaskPriority;
  rawConfidence: number;
  securityLevel: number;
  dateStr: string;
  proposedTimeRange?: { startTimeMs: number; endTimeMs: number };
  targetBlockId?: string;
  proposedPlanId?: string;
}

class DecisionEngineManager {
  private readonly config = DEFAULT_PLANNER_CONFIG;

  /**
   * Primary entry point to evaluate a candidate decision vector
   */
  async evaluateDecision(input: CandidateDecisionInput): Promise<{ decision: Decision; audit: DecisionAudit }> {
    const startTimeMs = Date.now();
    const sessionId = `dec_sess_${input.dateStr}_${Date.now()}`;

    // 1. Acquire Planning Session Lock for exclusive mutation
    const lockAcquired = await planningSessionLock.acquireLock(sessionId);
    if (!lockAcquired) {
      throw new Error(`[DecisionEngine] Locked: Concurrent decision evaluation active.`);
    }

    try {
      const decisionId = `dec_${input.category}_${Date.now()}`;
      const auditId = `audit_${decisionId}`;
      const rulesFired: string[] = [];
      const constraintsEvaluated: string[] = [];
      const rejectedAlternatives: Array<{ alternativeId: string; description: string; rejectionReason: string }> = [];

      // 2. Initial State: Evaluating
      let status: DecisionStatus = 'evaluating';
      let finalConfidence = input.rawConfidence;

      // 3. Fetch active constraints for target date
      const constraints = await constraintEngineManager.getActiveConstraints(input.dateStr);

      // 4. Hard Constraint Evaluation Gate
      let hardViolationFound = false;
      if (input.proposedTimeRange) {
        for (const c of constraints) {
          constraintsEvaluated.push(c.constraintId);
          if (c.isHard) {
            // Check interval overlap: [S, E] ∩ [S', E'] ≠ ∅
            const overlap = (input.proposedTimeRange.startTimeMs < c.affectedTimeRange.endTimeMs) &&
                            (input.proposedTimeRange.endTimeMs > c.affectedTimeRange.startTimeMs);
            if (overlap) {
              hardViolationFound = true;
              rejectedAlternatives.push({
                alternativeId: `alt_${c.constraintId}`,
                description: `Direct time assignment overlapping with ${c.title}`,
                rejectionReason: `Hard constraint violation: ${c.title} (${c.ruleIdentifier || 'HARD_BOUNDARY'})`
              });
              rulesFired.push(c.ruleIdentifier || 'HARD_CONSTRAINT_RULE');
              break;
            }
          } else {
            // Soft constraint penalty
            if (c.penaltyWeight) {
              finalConfidence = Math.max(0, finalConfidence - c.penaltyWeight);
              rulesFired.push(c.ruleIdentifier || 'SOFT_CONSTRAINT_PENALTY');
            }
          }
        }
      }

      // 5. Decision Lifecycle & Confidence Gating
      if (hardViolationFound) {
        status = 'rejected';
      } else if (finalConfidence < this.config.minimumConfidence) {
        status = 'rejected';
        rejectedAlternatives.push({
          alternativeId: `alt_low_conf_${decisionId}`,
          description: `Decision vector confidence ${Math.round(finalConfidence * 100)}%`,
          rejectionReason: `Below minimum confidence threshold (${Math.round(this.config.minimumConfidence * 100)}%)`
        });
        rulesFired.push('RULE_MINIMUM_CONFIDENCE_THRESHOLD');
      } else {
        status = 'proposed';
        rulesFired.push('RULE_DECISION_PROPOSED_SUCCESS');
      }

      const executionDurationMs = Date.now() - startTimeMs;

      // 6. Build Decision Object
      const decision: Decision = {
        decisionId,
        category: input.category,
        intent: input.intent,
        priority: input.priority,
        confidenceScore: parseFloat(finalConfidence.toFixed(2)),
        status,
        securityLevel: input.securityLevel,
        targetBlockId: input.targetBlockId,
        proposedPlanId: input.proposedPlanId
      };

      // 7. Build Immutable DecisionAudit Object
      const audit: DecisionAudit = {
        auditId,
        decisionId,
        timestamp: Date.now(),
        confidenceScore: decision.confidenceScore,
        rulesFired,
        constraintsEvaluated,
        rejectedAlternatives,
        executionDurationMs,
        plannerVersion: 'v7.1'
      };

      // 8. Persist Audit Record to Dexie db.decisionHistory
      await db.decisionHistory.add(audit);

      // 9. Emit strongly-typed DECISION_EVALUATED Event to Phase 5 Event Bus
      const payload: DecisionEvaluatedPayload = {
        decisionId: decision.decisionId,
        intent: decision.intent,
        confidenceScore: decision.confidenceScore,
        auditId: audit.auditId
      };
      await eventBus.publish(StandardEvents.DECISION_EVALUATED, payload);

      return { decision, audit };
    } finally {
      // Always release session lock
      planningSessionLock.releaseLock(sessionId);
    }
  }

  /**
   * Updates decision lifecycle status (e.g. proposed -> approved / rejected)
   */
  async updateDecisionStatus(decision: Decision, newStatus: DecisionStatus): Promise<Decision> {
    const updated: Decision = {
      ...decision,
      status: newStatus
    };
    return updated;
  }
}

export const decisionEngineManager = new DecisionEngineManager();
