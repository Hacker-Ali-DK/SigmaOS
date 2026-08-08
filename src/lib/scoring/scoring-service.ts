import { db, isPrayerCompleted, getPrayerStatus } from '../db';
import { type DailyScores, type ScoreDetail } from './types';

// Helper to check if a date is within range
export function isDateWithinRange(dateStr: string, startDateStr: string, endDateStr: string): boolean {
  return dateStr >= startDateStr && dateStr <= endDateStr;
}

export interface SelfControlDetail {
  score: number | 'untracked';
  urgesToday: number;
  resistedToday: number;
  relapsesToday: number;
}

export function deduplicateRoutinesInput(routines: any[]): any[] {
  if (!routines || routines.length === 0) return [];
  const map = new Map<string, any>();
  for (const r of routines) {
    if (!r || !r.taskName) continue;
    const key = String(r.taskName).toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, r);
    } else {
      const existing = map.get(key);
      if (!existing.completed && r.completed) {
        map.set(key, r);
      }
    }
  }
  return Array.from(map.values());
}

export function getTimezoneOfDayBounds(dateStr: string, timezone?: string): { startOfDay: number; endOfDay: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const tz = timezone || 'Asia/Karachi';

  try {
    const formatPart = (date: Date) => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(date);
    };

    const baseMidnightUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dateFormatted = formatPart(baseMidnightUTC);
    if (dateFormatted === dateStr) {
      // Local matches UTC base
    }
  } catch (e) {
    // Fallthrough to standard local midnight
  }

  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();

  return { startOfDay, endOfDay };
}

// Calculate self control score based on urges logged today
export async function calculateSelfControlForDate(dateStr: string): Promise<SelfControlDetail> {
  const profile = await db.userProfile.get(1);
  const { startOfDay, endOfDay } = getTimezoneOfDayBounds(dateStr, profile?.timezone);

  const dailyUrges = await db.dopamineUrges
    .where('timestamp')
    .between(startOfDay, endOfDay, true, true)
    .toArray();

  if (dailyUrges.length === 0) {
    return {
      score: 'untracked',
      urgesToday: 0,
      resistedToday: 0,
      relapsesToday: 0
    };
  }

  // Filter out unknown records (where resisted is undefined/null)
  const validUrges = dailyUrges.filter(u => u.resisted !== undefined && u.resisted !== null);

  if (validUrges.length === 0) {
    return {
      score: 'untracked',
      urgesToday: dailyUrges.length,
      resistedToday: 0,
      relapsesToday: 0
    };
  }

  const resistedCount = validUrges.filter(u => u.resisted === true).length;
  const relapseCount = validUrges.filter(u => u.resisted === false).length;
  const totalCount = resistedCount + relapseCount;

  const score = totalCount > 0 ? Math.round((resistedCount / totalCount) * 100) : 'untracked';

  return {
    score,
    urgesToday: dailyUrges.length,
    resistedToday: resistedCount,
    relapsesToday: relapseCount
  };
}

export function calculateSleepDuration(bedtimeStr: string, waketimeStr: string): number {
  if (!bedtimeStr || !waketimeStr) return 0;
  
  const timeOnly = (s: string) => s.includes('T') ? s.split('T')[1] : s;
  const bTime = timeOnly(bedtimeStr);
  const wTime = timeOnly(waketimeStr);

  const [bHours, bMins] = bTime.split(':').map(Number);
  const [wHours, wMins] = wTime.split(':').map(Number);
  
  if (isNaN(bHours) || isNaN(bMins) || isNaN(wHours) || isNaN(wMins)) return 0;

  const bedtimeMins = bHours * 60 + bMins;
  const waketimeMins = wHours * 60 + wMins;

  let diffMins = 0;
  if (waketimeMins < bedtimeMins) {
    diffMins = (24 * 60 - bedtimeMins) + waketimeMins;
  } else {
    diffMins = waketimeMins - bedtimeMins;
  }

  return Number((diffMins / 60).toFixed(2));
}

export function formatMinsToTime(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMins = String(minutes).padStart(2, '0');
  return `${displayHours}:${displayMins} ${period}`;
}

export function formatMinsToDurationStr(mins: number): string {
  if (mins < 60) return `±${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `±${h}h` : `±${h}h ${m}m`;
}

export function parseDurationFromTimeLabel(timeLabel?: string): { minutes: number; hours: number } | null {
  if (!timeLabel || typeof timeLabel !== 'string') return null;
  const str = timeLabel.trim();
  
  // Match hours: e.g. "2.5 Hrs", "1 Hr", "2 Hours", "2.5h"
  const hrMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)\b/i);
  if (hrMatch) {
    const hours = parseFloat(hrMatch[1]);
    if (!isNaN(hours) && hours > 0) {
      return { minutes: Math.round(hours * 60), hours };
    }
  }

  // Match minutes: e.g. "15 min", "30 mins", "15m", "45 minutes"
  const minMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|m)\b/i);
  if (minMatch) {
    const minutes = parseFloat(minMatch[1]);
    if (!isNaN(minutes) && minutes > 0) {
      return { minutes: Math.round(minutes), hours: minutes / 60 };
    }
  }

  return null;
}

export function calculateDailySleepScore(sleepLog: any, sleepTarget = 8.0): ScoreDetail {
  if (!sleepLog) {
    return {
      score: 0,
      status: 'insufficient',
      trackedCount: 0,
      totalCount: 3,
      positives: [],
      negatives: [],
      recommendation: "Log your sleep bedtime and wake-up times."
    };
  }

  const duration = sleepLog.totalHours || 0;
  const durationScore = Math.min(100, (duration / sleepTarget) * 100);

  const qualityRating = sleepLog.qualityRating || (sleepLog.qualityScore ? sleepLog.qualityScore / 20 : 4);
  const qualityScore = qualityRating * 20;

  const positives = [];
  const negatives = [];

  if (duration >= sleepTarget) {
    positives.push(`Sleep duration meets target (${duration.toFixed(1)}h)`);
  } else {
    negatives.push(`Sleep deficit (${duration.toFixed(1)}h vs target ${sleepTarget}h)`);
  }

  const qualityLabels = ["Very Poor", "Poor", "Average", "Good", "Excellent"];
  const qualityLabel = qualityLabels[Math.min(4, Math.max(0, Math.round(qualityRating) - 1))];
  if (qualityRating >= 4) {
    positives.push(`Sleep quality was ${qualityLabel}`);
  } else if (qualityRating <= 2) {
    negatives.push(`Poor sleep quality (${qualityLabel})`);
  }

  let finalScore = 60;
  let trackedCount = 2;
  let totalCount = 3;

  if (sleepLog.awakenings !== undefined && sleepLog.awakenings !== null) {
    trackedCount = 3;
    const awakeningsScore = Math.max(0, 100 - sleepLog.awakenings * 20);
    finalScore = Math.round(durationScore * 0.40 + qualityScore * 0.45 + awakeningsScore * 0.15);
    
    if (sleepLog.awakenings === 0) {
      positives.push(`No awakenings during the night`);
    } else if (sleepLog.awakenings >= 3) {
      negatives.push(`Woke up ${sleepLog.awakenings} times during the night`);
    }
  } else {
    totalCount = 2;
    finalScore = Math.round(durationScore * (40 / 85) + qualityScore * (45 / 85));
  }

  let recommendation = "Maintain bedtime consistency for optimal recovery.";
  if (duration < sleepTarget) {
    recommendation = "Try going to bed 30 mins earlier tonight to meet your sleep goal.";
  } else if (qualityRating < 3) {
    recommendation = "Avoid screens 1 hr before bedtime to improve sleep quality.";
  }

  return {
    score: Math.max(0, Math.min(finalScore, 100)),
    status: trackedCount === totalCount ? 'completed' : 'partial',
    trackedCount,
    totalCount,
    positives,
    negatives,
    recommendation
  };
}

export interface SleepConsistencyStats {
  averageBedtime: string;
  averageWakeup: string;
  averageDuration: number;
  bedtimeVariation: string;
  waketimeVariation: string;
  consistencyScore: number;
}

export function calculateSleepConsistencyStats(sleepLogs: any[], daysLimit = 7): SleepConsistencyStats {
  const validLogs = sleepLogs
    .filter(log => log.bedtime && log.waketime)
    .slice(-daysLimit);

  if (validLogs.length === 0) {
    return {
      averageBedtime: "N/A",
      averageWakeup: "N/A",
      averageDuration: 0,
      bedtimeVariation: "N/A",
      waketimeVariation: "N/A",
      consistencyScore: 100
    };
  }

  const bedtimesFromNoon = validLogs.map(log => {
    const timeOnly = log.bedtime.includes('T') ? log.bedtime.split('T')[1] : log.bedtime;
    const [h, m] = timeOnly.split(':').map(Number);
    const mins = h * 60 + m;
    return mins >= 720 ? mins - 720 : mins + 720;
  });

  const avgBedtimeFromNoon = bedtimesFromNoon.reduce((s, v) => s + v, 0) / bedtimesFromNoon.length;
  let avgBedtimeMins = avgBedtimeFromNoon + 720;
  if (avgBedtimeMins >= 1440) avgBedtimeMins -= 1440;

  const bedtimeDeviations = bedtimesFromNoon.map(v => Math.abs(v - avgBedtimeFromNoon));
  const avgBedtimeDev = bedtimeDeviations.reduce((s, v) => s + v, 0) / bedtimeDeviations.length;

  const wakeupsFromMidnight = validLogs.map(log => {
    const timeOnly = log.waketime.includes('T') ? log.waketime.split('T')[1] : log.waketime;
    const [h, m] = timeOnly.split(':').map(Number);
    return h * 60 + m;
  });

  const avgWakeupMins = wakeupsFromMidnight.reduce((s, v) => s + v, 0) / wakeupsFromMidnight.length;
  const wakeupDeviations = wakeupsFromMidnight.map(v => Math.abs(v - avgWakeupMins));
  const avgWakeupDev = wakeupDeviations.reduce((s, v) => s + v, 0) / wakeupDeviations.length;

  const avgDuration = validLogs.reduce((s, log) => s + log.totalHours, 0) / validLogs.length;

  const avgTotalDev = (avgBedtimeDev + avgWakeupDev) / 2;
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - avgTotalDev)));

  return {
    averageBedtime: formatMinsToTime(Math.round(avgBedtimeMins)),
    averageWakeup: formatMinsToTime(Math.round(avgWakeupMins)),
    averageDuration: Number(avgDuration.toFixed(1)),
    bedtimeVariation: formatMinsToDurationStr(Math.round(avgBedtimeDev)),
    waketimeVariation: formatMinsToDurationStr(Math.round(avgWakeupDev)),
    consistencyScore
  };
}

export async function calculateWellnessScore(
  date: string,
  profile: any,
  sleepLog: any,
  meals: any[],
  waterLog: any,
  workouts: any[],
  weightLog: any, // kept in signature for compatibility but ignored for score
  journal: any,
  rawRoutines?: any[]
): Promise<ScoreDetail> {
  const factors: { weight: number; score: number; name: string }[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];

  // 1. Sleep (25%)
  const sleepTarget = profile?.dailySleepTarget || 8.0;
  if (sleepLog) {
    const sleepScoreDetail = calculateDailySleepScore(sleepLog, sleepTarget);
    factors.push({ name: 'Sleep', weight: 25, score: sleepScoreDetail.score });
    
    positives.push(...sleepScoreDetail.positives);
    negatives.push(...sleepScoreDetail.negatives);
  }

  // 2. Nutrition (25%)
  const calorieTarget = profile?.dailyCalorieTarget || 2500;
  if (meals && meals.length > 0) {
    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.proteinGrams, 0);
    const proteinTarget = profile?.dailyProteinTarget || 120;

    const calorieScore = Math.max(0, 100 - Math.abs((totalCalories - calorieTarget) / calorieTarget) * 100);
    const proteinScore = Math.min(100, (totalProtein / proteinTarget) * 100);
    const nutritionScore = (calorieScore + proteinScore) / 2;

    factors.push({ name: 'Nutrition', weight: 25, score: nutritionScore });

    if (calorieScore >= 85) {
      positives.push(`Calories are on target (${totalCalories} kcal)`);
    } else {
      negatives.push(`Calorie target deviation (${totalCalories} kcal vs target of ${calorieTarget} kcal)`);
    }

    if (totalProtein >= proteinTarget) {
      positives.push(`Good protein intake (${totalProtein}g)`);
    } else if (totalProtein < proteinTarget * 0.67) {
      negatives.push(`Low protein intake (${totalProtein}g vs target of ${proteinTarget}g)`);
    }
  }

  // 3. Hydration (20%)
  const waterTarget = profile?.dailyWaterTarget || 3.0;
  if (waterLog) {
    const waterScore = Math.min((waterLog.amountLiters / waterTarget) * 100, 100);
    factors.push({ name: 'Hydration', weight: 20, score: waterScore });

    if (waterLog.amountLiters >= waterTarget) {
      positives.push(`Hydration target achieved (${waterLog.amountLiters}L)`);
    } else {
      negatives.push(`Hydration below target (${waterLog.amountLiters}L vs target of ${waterTarget}L)`);
    }
  }

  // 4. Workout (15%)
  const routines = rawRoutines ? deduplicateRoutinesInput(rawRoutines) : [];
  const workoutRoutine = routines.find(r => r.taskName.toLowerCase().includes('workout') || r.taskName.toLowerCase().includes('exercise'));
  const parsedWorkoutDuration = parseDurationFromTimeLabel(workoutRoutine?.timeLabel);
  const targetWorkoutMins = parsedWorkoutDuration ? parsedWorkoutDuration.minutes : 30;

  const workoutMins = workouts?.reduce((sum, w) => sum + w.durationMinutes, 0) || 0;
  if (workouts && workouts.length > 0) {
    const workoutScore = Math.min((workoutMins / targetWorkoutMins) * 100, 100);
    factors.push({ name: 'Physical Activity', weight: 15, score: workoutScore });
    
    if (workoutMins >= targetWorkoutMins) {
      positives.push(`Workout completed (${workoutMins} mins)`);
    } else {
      negatives.push(`Workout duration below target (${workoutMins} mins vs ${targetWorkoutMins} mins)`);
    }
  } else if (workoutRoutine) {
    const workoutScore = workoutRoutine.completed ? 100 : 0;
    factors.push({ name: 'Physical Activity', weight: 15, score: workoutScore });

    if (workoutRoutine.completed) {
      positives.push(`Workout routine completed`);
    } else {
      negatives.push(`Workout routine not completed`);
    }
  }

  // 5. Mood (7.5%)
  if (journal && journal.mood) {
    const moodMap = { great: 100, good: 100, neutral: 70, anxious: 40 };
    const moodScore = moodMap[journal.mood as 'great'|'good'|'neutral'|'anxious'] || 70;
    factors.push({ name: 'Mood', weight: 7.5, score: moodScore });

    if (journal.mood === 'great' || journal.mood === 'good') {
      positives.push(`Positive emotional state (${journal.mood})`);
    } else if (journal.mood === 'anxious') {
      negatives.push(`Feeling anxious or stressed`);
    }
  }

  // 6. Energy (7.5%)
  if (journal && journal.energy) {
    const energyMap = { high: 100, medium: 75, low: 40 };
    const energyScore = energyMap[journal.energy as 'high'|'medium'|'low'] || 75;
    factors.push({ name: 'Energy', weight: 7.5, score: energyScore });

    if (journal.energy === 'high') {
      positives.push(`High energy levels`);
    } else if (journal.energy === 'low') {
      negatives.push(`Experiencing low energy today`);
    }
  }

  const trackedCount = factors.length;
  const totalCount = 6;

  if (trackedCount === 0) {
    return {
      score: 0,
      status: 'insufficient',
      trackedCount: 0,
      totalCount,
      positives: [],
      negatives: [],
      recommendation: "Log your sleep, water, or meals to get a wellness score."
    };
  }

  // STRICT BASELINE: Always divide by 100 instead of totalTrackedWeight
  const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  const finalScore = Math.round(weightedSum / 100);

  let recommendation = "Keep tracking your daily routine, champion!";
  const lowestFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  if (lowestFactor && lowestFactor.score < 80) {
    recommendation = `Your biggest opportunity tomorrow is improving ${lowestFactor.name.toLowerCase()} consistency.`;
  }

  return {
    score: Math.max(0, Math.min(finalScore, 100)),
    status: trackedCount >= 4 ? 'completed' : 'partial',
    trackedCount,
    totalCount,
    positives,
    negatives,
    recommendation
  };
}

export async function calculateDisciplineScore(
  date: string,
  rawRoutines: any[],
  journal: any,
  activeGoals: any[]
): Promise<ScoreDetail> {
  const routines = deduplicateRoutinesInput(rawRoutines);
  const profile = await db.userProfile.get(1);
  const screenTimeLimit = profile?.dailyScreenTimeTarget ?? 4.0;

  const factors: { weight: number; score: number; name: string }[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];

  // 1. Non-prayer, Non-Quran Routines (40%)
  const nonPrayerRoutines = routines.filter(r => 
    !['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', "qur'an", "quran"].includes(r.taskName.toLowerCase())
  );
  if (nonPrayerRoutines.length > 0) {
    const completed = nonPrayerRoutines.filter(r => r.completed).length;
    const routineScore = (completed / nonPrayerRoutines.length) * 100;
    factors.push({ name: 'Routines', weight: 40, score: routineScore });

    if (routineScore >= 80) {
      positives.push(`Completed most of today's routines (${completed}/${nonPrayerRoutines.length})`);
    } else if (routineScore < 50) {
      negatives.push(`Missed several routine tasks (${completed}/${nonPrayerRoutines.length} done)`);
    }
  }

  // 2. Study / Learning (20%)
  const studyRoutines = routines.filter(r => 
    r.taskName.toLowerCase().includes('study') || r.taskName.toLowerCase().includes('programming') || r.taskName.toLowerCase().includes('learn')
  );

  if (studyRoutines.length > 0) {
    let requiredHoursSum = 0;
    let fulfilledHoursSum = 0;

    for (const r of studyRoutines) {
      const parsed = parseDurationFromTimeLabel(r.timeLabel);
      const reqH = parsed ? parsed.hours : 2.5;
      requiredHoursSum += reqH;
      if (r.completed) {
        fulfilledHoursSum += reqH;
      }
    }

    const studyScore = requiredHoursSum > 0 
      ? Math.min(100, Math.max(0, Math.round((fulfilledHoursSum / requiredHoursSum) * 100))) 
      : 0;

    factors.push({ name: 'Study/Learning', weight: 20, score: studyScore });

    if (studyScore >= 80) {
      positives.push(`Productive learning session (${fulfilledHoursSum.toFixed(1)} hrs)`);
    } else if (fulfilledHoursSum > 0) {
      negatives.push(`Short study duration (${fulfilledHoursSum.toFixed(1)} hrs vs target of ${requiredHoursSum.toFixed(1)} hrs)`);
    } else {
      negatives.push("No study sessions completed today");
    }
  }

  // 3. Reading (15%)
  const readingRoutine = routines.find(r => r.taskName.toLowerCase().includes('read') || r.taskName.toLowerCase().includes('book'));
  if (readingRoutine) {
    const readScore = readingRoutine.completed ? 100 : 0;
    factors.push({ name: 'Reading', weight: 15, score: readScore });

    if (readingRoutine.completed) {
      positives.push("Completed daily reading habit");
    } else {
      negatives.push("Missed daily reading target");
    }
  }

  // 4. Screen Time (15%)
  if (journal && journal.screenHours !== undefined && journal.screenHours !== null) {
    const recHours = journal.screenHours;
    const screenScore = Math.max(0, 100 - Math.max(0, recHours - screenTimeLimit) * 25);
    factors.push({ name: 'Screen Time', weight: 15, score: screenScore });

    if (recHours <= screenTimeLimit) {
      positives.push(`Controlled recreational screen time (${recHours} hrs)`);
    } else {
      negatives.push(`Excessive recreational screen time (${recHours} hrs vs target limit of ${screenTimeLimit} hrs)`);
    }
  }

  if (journal && journal.productiveScreenHours !== undefined && journal.productiveScreenHours !== null && journal.productiveScreenHours > 0) {
    positives.push(`Logged productive screen time (${journal.productiveScreenHours} hrs)`);
  }

  // 5. Daily Discipline Commitments (10%)
  // Filter for active non-Deen goals that explicitly represent a concrete daily commitment due today
  const dailyDisciplineCommitments = activeGoals?.filter(g => 
    g.category !== 'deen' && (g.isDailyCommitment === true || g.unit === 'daily')
  ) || [];

  if (dailyDisciplineCommitments.length > 0) {
    let sumProgress = 0;
    for (const g of dailyDisciplineCommitments) {
      let p = 0;
      if (g.targetValue === g.currentValue) p = 100;
      else if (g.targetValue > 0) {
        p = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
      }
      sumProgress += p;
    }
    const goalScore = sumProgress / dailyDisciplineCommitments.length;
    factors.push({ name: 'Goal Progress', weight: 10, score: goalScore });

    if (goalScore >= 50) {
      positives.push(`On track with daily commitments (${Math.round(goalScore)}% average progress)`);
    } else {
      negatives.push(`Slow goal progress (${Math.round(goalScore)}% overall progress)`);
    }
  }

  const trackedCount = factors.length;
  const totalCount = 5;

  if (trackedCount === 0) {
    return {
      score: 0,
      status: 'insufficient',
      trackedCount: 0,
      totalCount,
      positives: [],
      negatives: [],
      recommendation: "Log screen time or complete routine items to track discipline."
    };
  }

  // STRICT BASELINE: Always divide by 100 instead of totalTrackedWeight
  const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  const finalScore = Math.round(weightedSum / 100);

  let recommendation = "Maintain discipline to lock down consistency!";
  const lowestFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  if (lowestFactor && lowestFactor.score < 80) {
    recommendation = `Your biggest opportunity tomorrow is improving ${lowestFactor.name.toLowerCase()} consistency.`;
  }

  return {
    score: Math.max(0, Math.min(finalScore, 100)),
    status: trackedCount >= 3 ? 'completed' : 'partial',
    trackedCount,
    totalCount,
    positives,
    negatives,
    recommendation
  };
}

export async function calculateDeenScore(
  date: string,
  prayers: any,
  rawRoutines: any[],
  activeGoals: any[]
): Promise<ScoreDetail> {
  const routines = deduplicateRoutinesInput(rawRoutines);
  const factors: { weight: number; score: number; name: string }[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

  // 1. Daily Prayers (60%)
  let trackedPrayerPointsSum = 0;
  let trackedPrayerCount = 0;
  const onTimeList: string[] = [];
  const lateList: string[] = [];
  const missedList: string[] = [];

  prayerNames.forEach(field => {
    let status: string | undefined = undefined;

    if (prayers && prayers[field] !== undefined) {
      status = getPrayerStatus(prayers[field]);
    } else {
      const routineTask = routines?.find(r => r.taskName.toLowerCase() === field);
      if (routineTask) {
        status = routineTask.completed ? 'prayed_on_time' : undefined;
      }
    }

    if (status === 'prayed_on_time') {
      trackedPrayerPointsSum += 100;
      trackedPrayerCount++;
      onTimeList.push(field.charAt(0).toUpperCase() + field.slice(1));
    } else if (status === 'prayed_late') {
      trackedPrayerPointsSum += 50;
      trackedPrayerCount++;
      lateList.push(field.charAt(0).toUpperCase() + field.slice(1));
    } else if (status === 'missed') {
      trackedPrayerPointsSum += 0;
      trackedPrayerCount++;
      missedList.push(field.charAt(0).toUpperCase() + field.slice(1));
    }
    // not_tracked, pending, window_expired are excluded from positive points
  });

  const hasPrayerData = trackedPrayerCount > 0 || (prayers && (prayers.fajr !== undefined || prayers.dhuhr !== undefined || prayers.asr !== undefined || prayers.maghrib !== undefined || prayers.isha !== undefined));

  if (hasPrayerData) {
    const prayerScore = Math.round(trackedPrayerPointsSum / 5);
    factors.push({ name: 'Prayers', weight: 60, score: prayerScore });

    if (onTimeList.length > 0) {
      positives.push(`Prayed on time: ${onTimeList.join(', ')}`);
    }
    if (lateList.length > 0) {
      positives.push(`Prayed late: ${lateList.join(', ')}`);
    }
    if (missedList.length > 0) {
      negatives.push(`Opportunity to make up: ${missedList.join(', ')}`);
    }
  }

  // 2. Qur'an Recitation (25%)
  const quranRoutine = routines?.find(r => r.taskName.toLowerCase().includes("qur'an") || r.taskName.toLowerCase().includes("quran"));
  const parsedDuration = parseDurationFromTimeLabel(quranRoutine?.timeLabel);
  const requiredQuranMins = parsedDuration ? parsedDuration.minutes : 30;
  let actualQuranMins: number | undefined = undefined;

  if (prayers && prayers.quranMinutes !== undefined && prayers.quranMinutes !== null) {
    actualQuranMins = prayers.quranMinutes;
  } else if (quranRoutine) {
    actualQuranMins = quranRoutine.completed ? requiredQuranMins : 0;
  }

  if (actualQuranMins !== undefined) {
    const quranScore = Math.min(100, Math.max(0, Math.round((actualQuranMins / requiredQuranMins) * 100)));
    factors.push({ name: 'Qur\'an reading', weight: 25, score: quranScore });

    if (actualQuranMins >= requiredQuranMins) {
      positives.push(`Recited Qur'an for ${actualQuranMins} mins`);
    } else if (actualQuranMins > 0) {
      negatives.push(`Recited Qur'an for ${actualQuranMins} mins (target: ${requiredQuranMins} mins)`);
    } else {
      negatives.push("No Qur'an recitation logged yet today");
    }
  }

  // 3. Daily Deen Commitments (15%)
  // Filter active goals for concrete daily Deen commitments due today (excluding cumulative goals like 30 days Fajr)
  const dailyDeenCommitments = activeGoals?.filter(g => 
    g.category === 'deen' && (g.isDailyCommitment === true || g.unit === 'daily')
  ) || [];

  if (dailyDeenCommitments.length > 0) {
    let sumProgress = 0;
    for (const g of dailyDeenCommitments) {
      let p = 0;
      if (g.targetValue === g.currentValue) p = 100;
      else if (g.targetValue > 0) {
        p = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
      }
      sumProgress += p;
    }
    const deenGoalScore = Math.round(sumProgress / dailyDeenCommitments.length);
    factors.push({ name: 'Islamic Goals', weight: 15, score: deenGoalScore });

    if (deenGoalScore >= 50) {
      positives.push("Steady progress on daily Islamic commitments");
    } else {
      negatives.push("Ongoing progress on daily Islamic commitments");
    }
  }

  const trackedCount = factors.length;
  const totalCount = 3;

  if (trackedCount === 0) {
    return {
      score: 0,
      status: 'insufficient',
      trackedCount: 0,
      totalCount,
      positives: [],
      negatives: [],
      recommendation: "Log your prayers or Qur'an recitation to track your Deen score."
    };
  }

  // STRICT BASELINE: Always divide by 100 instead of totalTrackedWeight
  const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  const finalScore = Math.round(weightedSum / 100);

  let recommendation = "Prioritize daily prayers as peaceful anchors of your day.";
  const lowestFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  if (lowestFactor && lowestFactor.score < 80) {
    recommendation = `Focus on nurturing ${lowestFactor.name.toLowerCase()} consistency tomorrow.`;
  }

  return {
    score: Math.max(0, Math.min(finalScore, 100)),
    status: trackedCount === totalCount ? 'completed' : 'partial',
    trackedCount,
    totalCount,
    positives,
    negatives,
    recommendation
  };
}

export async function calculateScoresForDate(dateStr: string): Promise<DailyScores> {
  const profile = await db.userProfile.get(1);
  const sleepLog = await db.sleep.get(dateStr);
  const meals = await db.meals.where({ date: dateStr }).toArray();
  const waterLog = await db.water.get(dateStr);
  const workouts = await db.workouts.where({ date: dateStr }).toArray();
  const weightLog = await db.weight.get(dateStr);
  const journal = await db.journal.get(dateStr);
  const prayers = await db.prayers.get(dateStr);
  const routines = await db.routines.where({ date: dateStr }).toArray();
  const allGoals = await db.goals.toArray();
  const filteredActiveGoals = allGoals.filter(g => !g.completed);

  const wellness = await calculateWellnessScore(dateStr, profile, sleepLog, meals, waterLog, workouts, weightLog, journal, routines);
  const discipline = await calculateDisciplineScore(dateStr, routines, journal, filteredActiveGoals);
  const deen = await calculateDeenScore(dateStr, prayers, routines, filteredActiveGoals);
  const selfControl = await calculateSelfControlForDate(dateStr);

  // Overall Alignment is the average of active scores that are tracked / not insufficient
  const activeScores: number[] = [];
  if (wellness.status !== 'insufficient' && (wellness.status as string) !== 'untracked') activeScores.push(wellness.score);
  if (discipline.status !== 'insufficient' && (discipline.status as string) !== 'untracked') activeScores.push(discipline.score);
  if (deen.status !== 'insufficient' && (deen.status as string) !== 'untracked') activeScores.push(deen.score);
  if (selfControl.score !== 'untracked') activeScores.push(selfControl.score as number);

  const overallAlignment = activeScores.length > 0 
    ? Math.round(activeScores.reduce((sum, s) => sum + s, 0) / activeScores.length)
    : 0; // 0 fallback when no category is tracked

  return {
    wellness,
    discipline,
    deen,
    overallAlignment,
    selfControl
  };
}

// Calculate long term consistency score (rolling average of Alignment Score)
export async function calculateLongTermConsistency(endDateStr: string, daysLimit = 90): Promise<number> {
  // Generate list of dates
  const dates: string[] = [];
  const end = new Date(endDateStr);
  for (let i = daysLimit - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  // Batch load metrics in range
  const startDateStr = dates[0];
  const [
    sleepLogs,
    mealsLogs,
    waterLogs,
    workoutLogs,
    weightLogs,
    journalLogs,
    prayerLogs,
    routineLogs,
    allGoals
  ] = await Promise.all([
    db.sleep.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.meals.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.water.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.workouts.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.weight.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.journal.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.prayers.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.routines.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.goals.toArray()
  ]);

  const sleepMap = new Map(sleepLogs.map(l => [l.date, l]));
  const waterMap = new Map(waterLogs.map(l => [l.date, l]));
  const weightMap = new Map(weightLogs.map(l => [l.date, l]));
  const journalMap = new Map(journalLogs.map(l => [l.date, l]));
  const prayerMap = new Map(prayerLogs.map(l => [l.date, l]));

  const mealsGrouped = new Map<string, any[]>();
  mealsLogs.forEach(m => {
    const arr = mealsGrouped.get(m.date) || [];
    arr.push(m);
    mealsGrouped.set(m.date, arr);
  });

  const workoutsGrouped = new Map<string, any[]>();
  workoutLogs.forEach(w => {
    const arr = workoutsGrouped.get(w.date) || [];
    arr.push(w);
    workoutsGrouped.set(w.date, arr);
  });

  const routinesGrouped = new Map<string, any[]>();
  routineLogs.forEach(r => {
    const arr = routinesGrouped.get(r.date) || [];
    arr.push(r);
    routinesGrouped.set(r.date, arr);
  });

  const profile = await db.userProfile.get(1);
  const activeGoals = allGoals.filter(g => !g.completed);

  let totalScoreSum = 0;
  let daysWithData = 0;

  for (const dateStr of dates) {
    const sleep = sleepMap.get(dateStr);
    const meals = mealsGrouped.get(dateStr) || [];
    const water = waterMap.get(dateStr);
    const wrkouts = workoutsGrouped.get(dateStr) || [];
    const weight = weightMap.get(dateStr);
    const jrnl = journalMap.get(dateStr);
    const prayer = prayerMap.get(dateStr);
    const rts = routinesGrouped.get(dateStr) || [];

    const wellness = await calculateWellnessScore(dateStr, profile, sleep, meals, water, wrkouts, weight, jrnl, rts);
    const discipline = await calculateDisciplineScore(dateStr, rts, jrnl, activeGoals);
    const deen = await calculateDeenScore(dateStr, prayer, rts, activeGoals);

    const activeScores: number[] = [];
    if (wellness.status !== 'insufficient') activeScores.push(wellness.score);
    if (discipline.status !== 'insufficient') activeScores.push(discipline.score);
    if (deen.status !== 'insufficient') activeScores.push(deen.score);

    if (activeScores.length > 0) {
      const dailyAlignment = Math.round(activeScores.reduce((sum, s) => sum + s, 0) / activeScores.length);
      totalScoreSum += dailyAlignment;
      daysWithData++;
    }
  }

  return daysWithData > 0 ? Math.round(totalScoreSum / daysWithData) : 0;
}

export interface HistoricalScoreEntry {
  name: string; // e.g. "Mon" or "15 Jul"
  dateStr: string; // YYYY-MM-DD
  Wellness: number;
  Discipline: number;
  Deen: number;
  Alignment: number;
}

export async function calculateHistoricalScoresForRange(
  endDateStr: string,
  daysLimit = 7
): Promise<HistoricalScoreEntry[]> {
  const dates: string[] = [];
  const end = new Date(endDateStr);
  for (let i = daysLimit - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  const startDateStr = dates[0];
  const [
    sleepLogs,
    mealsLogs,
    waterLogs,
    workoutLogs,
    weightLogs,
    journalLogs,
    prayerLogs,
    routineLogs,
    allGoals
  ] = await Promise.all([
    db.sleep.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.meals.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.water.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.workouts.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.weight.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.journal.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.prayers.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.routines.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.goals.toArray()
  ]);

  const sleepMap = new Map(sleepLogs.map(l => [l.date, l]));
  const waterMap = new Map(waterLogs.map(l => [l.date, l]));
  const weightMap = new Map(weightLogs.map(l => [l.date, l]));
  const journalMap = new Map(journalLogs.map(l => [l.date, l]));
  const prayerMap = new Map(prayerLogs.map(l => [l.date, l]));

  const mealsGrouped = new Map<string, any[]>();
  mealsLogs.forEach(m => {
    const arr = mealsGrouped.get(m.date) || [];
    arr.push(m);
    mealsGrouped.set(m.date, arr);
  });

  const workoutsGrouped = new Map<string, any[]>();
  workoutLogs.forEach(w => {
    const arr = workoutsGrouped.get(w.date) || [];
    arr.push(w);
    workoutsGrouped.set(w.date, arr);
  });

  const routinesGrouped = new Map<string, any[]>();
  routineLogs.forEach(r => {
    const arr = routinesGrouped.get(r.date) || [];
    arr.push(r);
    routinesGrouped.set(r.date, arr);
  });

  const profile = await db.userProfile.get(1);
  const activeGoals = allGoals.filter(g => !g.completed);

  const results: HistoricalScoreEntry[] = [];

  for (const dateStr of dates) {
    const sleep = sleepMap.get(dateStr);
    const meals = mealsGrouped.get(dateStr) || [];
    const water = waterMap.get(dateStr);
    const wrkouts = workoutsGrouped.get(dateStr) || [];
    const weight = weightMap.get(dateStr);
    const jrnl = journalMap.get(dateStr);
    const prayer = prayerMap.get(dateStr);
    const rts = routinesGrouped.get(dateStr) || [];

    const wellness = await calculateWellnessScore(dateStr, profile, sleep, meals, water, wrkouts, weight, jrnl, rts);
    const discipline = await calculateDisciplineScore(dateStr, rts, jrnl, activeGoals);
    const deen = await calculateDeenScore(dateStr, prayer, rts, activeGoals);

    const wellnessScore = wellness.status === 'insufficient' ? 0 : wellness.score;
    const disciplineScore = discipline.status === 'insufficient' ? 0 : discipline.score;
    const deenScore = deen.status === 'insufficient' ? 0 : deen.score;

    const activeScores: number[] = [];
    if (wellness.status !== 'insufficient') activeScores.push(wellness.score);
    if (discipline.status !== 'insufficient') activeScores.push(discipline.score);
    if (deen.status !== 'insufficient') activeScores.push(deen.score);

    const dailyAlignment = activeScores.length > 0
      ? Math.round(activeScores.reduce((sum, s) => sum + s, 0) / activeScores.length)
      : 0;

    let name = dateStr;
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (daysLimit <= 7) {
        name = d.toLocaleDateString('en-US', { weekday: 'short' });
      } else {
        name = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      }
    } catch (e) {}

    results.push({
      name,
      dateStr,
      Wellness: wellnessScore,
      Discipline: disciplineScore,
      Deen: deenScore,
      Alignment: dailyAlignment
    });
  }

  return results;
}
