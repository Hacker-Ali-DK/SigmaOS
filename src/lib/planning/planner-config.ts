import type { PlannerConfig } from './types';

/**
 * Recovery+ Phase 7 & 7.1 Runtime Planner Configuration Parameters
 * Replaces hardcoded solver constants with validated, configurable properties.
 */
export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  minimumConfidence: 0.75,          // Minimum 75% confidence gating
  debounceWindowMs: 300,           // 300ms trigger debouncing window
  maximumPlanningTimeMs: 5000,      // 5,000ms max solver computation timeout
  studyBlockLengthMins: 90,        // 90m continuous cognitive focus blocks
  breakLengthMins: 15,             // 15m cognitive recovery break buffers
  minimumSleepHours: 6.0,          // 6.0h minimum uninterrupted sleep boundary
  prayerBufferMins: 15,            // 15m pre-prayer Wudu preparation buffer
  workerTimeoutMs: 5000,           // 5,000ms Web Worker execution timeout
  revisionLimitPerDay: 10,         // Max 10 plan revisions retained per date
  learningRate: 0.05               // 0.05 local offline weight learning rate
};
