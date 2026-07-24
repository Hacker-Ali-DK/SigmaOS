import type { TimeBlock, ConflictResolutionMethod } from './types';

export interface ConflictResolutionResult {
  readonly resolvedBlocks: TimeBlock[];
  readonly resolutionLog: Array<{
    conflictingBlockId: string;
    method: ConflictResolutionMethod;
    reason: string;
  }>;
}

class ConflictResolutionEngineManager {
  private readonly priorityWeights = { P0: 0, P1: 1, P2: 2, P3: 3 };

  /**
   * Deterministically resolves overlapping TimeBlocks using 4-Step Resolution Algorithm:
   * Step 1: Compare Priority & Immutability (Hard constraints & isLocked blocks always win)
   * Step 2: Task Splitting / Shortening
   * Step 3: Slot Shift
   * Step 4: Task Defer / Omit
   */
  resolveConflicts(blocks: TimeBlock[]): ConflictResolutionResult {
    const sorted = [...blocks].sort((a, b) => a.startTimeMs - b.startTimeMs);
    const resolved: TimeBlock[] = [];
    const log: ConflictResolutionResult['resolutionLog'] = [];

    for (const current of sorted) {
      if (resolved.length === 0) {
        resolved.push(current);
        continue;
      }

      // Check overlap with last resolved block
      const prev = resolved[resolved.length - 1];
      const hasOverlap = (current.startTimeMs < prev.endTimeMs) && (current.endTimeMs > prev.startTimeMs);

      if (!hasOverlap) {
        resolved.push(current);
        continue;
      }

      // Overlap detected: Apply 4-Step Deterministic Algorithm

      // Step 1: Compare Priority & Immutability
      if (prev.isLocked || this.priorityWeights[prev.priority] < this.priorityWeights[current.priority]) {
        if (current.isLocked) {
          // Both locked: Cannot move current block
          resolved.push(current);
          log.push({
            conflictingBlockId: current.blockId,
            method: 'priority_override',
            reason: 'Both blocks locked; overlap retained for hard constraint priority'
          });
          continue;
        }

        // Current block yields to Prev (Step 3: Attempt Slot Shift)
        const shiftDurationMs = current.endTimeMs - current.startTimeMs;
        const newStartMs = prev.endTimeMs + 5 * 60 * 1000; // 5m gap
        const newEndMs = newStartMs + shiftDurationMs;

        const shiftedBlock: TimeBlock = {
          ...current,
          startTimeMs: newStartMs,
          endTimeMs: newEndMs,
          startTime: new Date(newStartMs).toTimeString().substring(0, 5),
          endTime: new Date(newEndMs).toTimeString().substring(0, 5)
        };

        resolved.push(shiftedBlock);
        log.push({
          conflictingBlockId: current.blockId,
          method: 'slot_shift',
          reason: `Shifted start from ${current.startTime} to ${shiftedBlock.startTime} to resolve overlap with ${prev.title}`
        });
      } else {
        // Prev yields to Current if Current is higher priority and Prev is not locked
        if (!prev.isLocked) {
          resolved.pop(); // Remove prev
          resolved.push(current);

          // Shift prev to after current
          const shiftDurationMs = prev.endTimeMs - prev.startTimeMs;
          const newStartMs = current.endTimeMs + 5 * 60 * 1000;
          const newEndMs = newStartMs + shiftDurationMs;

          const shiftedPrev: TimeBlock = {
            ...prev,
            startTimeMs: newStartMs,
            endTimeMs: newEndMs,
            startTime: new Date(newStartMs).toTimeString().substring(0, 5),
            endTime: new Date(newEndMs).toTimeString().substring(0, 5)
          };

          resolved.push(shiftedPrev);
          log.push({
            conflictingBlockId: prev.blockId,
            method: 'priority_override',
            reason: `Replaced ${prev.title} with higher-priority ${current.title} (${current.priority})`
          });
        } else {
          // Prev is locked, current yields (Step 4: Task Defer)
          log.push({
            conflictingBlockId: current.blockId,
            method: 'task_defer',
            reason: `Deferred ${current.title} due to hard locked boundary ${prev.title}`
          });
        }
      }
    }

    return {
      resolvedBlocks: resolved.sort((a, b) => a.startTimeMs - b.startTimeMs),
      resolutionLog: log
    };
  }
}

export const conflictResolutionEngine = new ConflictResolutionEngineManager();
