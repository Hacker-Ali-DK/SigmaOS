import type { EventEnvelope } from './types';

export class CrossModuleReactionSystem {
  private readonly maxCausalDepth = 5;

  /**
   * Evaluates event for DAG compliance and causal depth limits
   */
  validateReaction(parentEnvelope: EventEnvelope, childTopic: string): { isValid: boolean; nextDepth: number } {
    const nextDepth = parentEnvelope.causalDepth + 1;

    // 1. Hard block if causal depth exceeds 5 hops
    if (nextDepth > this.maxCausalDepth) {
      console.warn(`[ReactionSystem] Anti-Circular Rule Triggered: Blocked topic ${childTopic} at depth ${nextDepth}`);
      return { isValid: false, nextDepth };
    }

    // 2. Prevent self-looping on identical topic
    if (parentEnvelope.topic === childTopic) {
      console.warn(`[ReactionSystem] Anti-Circular Rule Triggered: Blocked self-loop topic ${childTopic}`);
      return { isValid: false, nextDepth };
    }

    return { isValid: true, nextDepth };
  }
}

export const crossModuleReactionSystem = new CrossModuleReactionSystem();
