import { db } from '@/lib/db';
import { calculatePrayerTimes } from '@/lib/deen/prayer-engine';
import { DEFAULT_PLANNER_CONFIG } from './planner-config';
import type { Constraint, ConstraintType, ConstraintSeverity } from './types';

class ConstraintEngineManager {
  private readonly config = DEFAULT_PLANNER_CONFIG;

  /**
   * Generates and returns all active Hard and Soft constraints for a given date.
   * Leverages Dexie db.constraintCache for high-speed retrieval.
   */
  async getActiveConstraints(dateStr: string): Promise<Constraint[]> {
    // 1. Try fetching cached constraints for date
    const cacheKey = `constraints_${dateStr}`;
    const cached = await db.constraintCache.where({ key: cacheKey }).toArray();

    if (cached.length > 0) {
      return cached;
    }

    // 2. Cache miss -> Calculate fresh constraints
    const constraints = await this.computeFreshConstraints(dateStr);

    // 3. Cache fresh constraints in Dexie
    for (const c of constraints) {
      await db.constraintCache.put({
        ...c,
        key: cacheKey
      } as any);
    }

    return constraints;
  }

  /**
   * Computes Hard and Soft constraints from Solar Engine and User Settings
   */
  private async computeFreshConstraints(dateStr: string): Promise<Constraint[]> {
    const constraints: Constraint[] = [];
    const userProfile = (await db.userProfile.toArray())[0];
    const dateObj = new Date(dateStr);

    // A. HARD CONSTRAINTS: Solar Prayer Windows & Wudu Buffers
    const prayerTimes = calculatePrayerTimes({
      date: dateObj,
      latitude: userProfile?.latitude ?? 24.8607,
      longitude: userProfile?.longitude ?? 67.0011,
      timezone: userProfile?.timezone ?? 'Asia/Karachi',
      method: userProfile?.prayerMethod ?? 'karachi',
      asrMethod: userProfile?.asrMethod ?? 'standard',
      ishaPolicy: userProfile?.ishaPolicy ?? 'fajr'
    });

    const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
    const bufferMs = this.config.prayerBufferMins * 60 * 1000;

    for (const prayer of prayerNames) {
      const timeStr = prayerTimes[prayer];
      if (typeof timeStr === 'string' && timeStr) {
        const startMs = new Date(`${dateStr}T${timeStr}:00`).getTime();
        const endMs = startMs + 30 * 60 * 1000; // 30-minute prayer window

        if (!isNaN(startMs)) {
          // Hard Prayer Constraint
          constraints.push({
            constraintId: `hard_prayer_${prayer}_${dateStr}`,
            type: 'solar_prayer',
            severity: 'hard',
            title: `${prayer.toUpperCase()} Prayer Window`,
            affectedTimeRange: {
              startTime: timeStr,
              endTime: new Date(endMs).toTimeString().substring(0, 5),
              startTimeMs: startMs,
              endTimeMs: endMs
            },
            isHard: true,
            ruleIdentifier: 'RULE_SOLAR_PRAYER_SUPREMACY'
          });

          // Hard Wudu Buffer Constraint (15m before prayer)
          constraints.push({
            constraintId: `hard_wudu_${prayer}_${dateStr}`,
            type: 'wudu_buffer',
            severity: 'hard',
            title: `Wudu Preparation Buffer (${prayer.toUpperCase()})`,
            affectedTimeRange: {
              startTime: new Date(startMs - bufferMs).toTimeString().substring(0, 5),
              endTime: timeStr,
              startTimeMs: startMs - bufferMs,
              endTimeMs: startMs
            },
            isHard: true,
            ruleIdentifier: 'RULE_WUDU_PREPARATION'
          });
        }
      }
    }

    // B. HARD CONSTRAINT: Minimum Sleep Architecture (6.0h uninterrupted nighttime block)
    const sleepStartMs = new Date(`${dateStr}T23:00:00`).getTime();
    const sleepEndMs = sleepStartMs + this.config.minimumSleepHours * 60 * 60 * 1000;
    constraints.push({
      constraintId: `hard_sleep_${dateStr}`,
      type: 'sleep_architecture',
      severity: 'hard',
      title: 'Minimum Sleep Architecture Boundary (6.0h)',
      affectedTimeRange: {
        startTime: '23:00',
        endTime: new Date(sleepEndMs).toTimeString().substring(0, 5),
        startTimeMs: sleepStartMs,
        endTimeMs: sleepEndMs
      },
      isHard: true,
      ruleIdentifier: 'RULE_MINIMUM_SLEEP_BOUNDARY'
    });

    // C. SOFT CONSTRAINT: Energy Curve Peak Matching
    const peakStartMs = new Date(`${dateStr}T09:00:00`).getTime();
    const peakEndMs = new Date(`${dateStr}T12:00:00`).getTime();
    constraints.push({
      constraintId: `soft_energy_peak_${dateStr}`,
      type: 'energy_peak',
      severity: 'soft',
      title: 'Circadian Peak Cognitive Focus Window',
      affectedTimeRange: {
        startTime: '09:00',
        endTime: '12:00',
        startTimeMs: peakStartMs,
        endTimeMs: peakEndMs
      },
      isHard: false,
      penaltyWeight: 0.15,
      ruleIdentifier: 'RULE_ENERGY_PEAK_MATCHING'
    });

    return constraints;
  }

  /**
   * Automatic Cache Invalidation for 5 Specific Trigger Rules:
   * 1. Timezone Changes
   * 2. Prayer Calculation Method Changes
   * 3. User Profile Target Changes
   * 4. Fixed Schedule Changes
   * 5. Sleep Target Changes
   */
  async invalidateConstraintCache(triggerReason: 'timezone' | 'prayer_method' | 'user_profile' | 'fixed_schedule' | 'sleep_target'): Promise<void> {
    console.log(`[ConstraintEngine] Invalidating constraintCache due to trigger: ${triggerReason}`);
    await db.constraintCache.clear();
  }
}

export const constraintEngineManager = new ConstraintEngineManager();
