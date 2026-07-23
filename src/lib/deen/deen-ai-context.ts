import { db, getPrayerStatus } from '../db';
import { calculateDeenScore } from '../scoring/scoring-service';

export interface PrayerAIStats {
  onTimeCount: number;
  lateCount: number;
  missedCount: number;
  trackedCount: number;
  applicableCount: number;
  onTimeRate: number;
}

export interface DeenAIContext {
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  prayerTracking: {
    applicablePrayers: number;
    trackedPrayers: number;
    coveragePercent: number;
    onTimeCount: number;
    lateCount: number;
    missedCount: number;
    onTimeRate: number;
    lateRate: number;
    missedRate: number;
    byPrayer: {
      fajr: PrayerAIStats;
      dhuhr: PrayerAIStats;
      asr: PrayerAIStats;
      maghrib: PrayerAIStats;
      isha: PrayerAIStats;
    };
  };
  quran: {
    activeDays: number;
    totalMinutes: number;
    averageMinutesPerActiveDay: number;
    averageMinutesPerCalendarDay: number;
    status: 'tracked' | 'untracked' | 'insufficient';
  };
  deenScore: {
    score?: number;
    status: 'insufficient' | 'partial' | 'completed';
    trackedFactors: number;
    totalFactors: 3;
  };
  goals: {
    tracked: boolean;
    activeCount: number;
    completedCount: number;
  };
}

export async function getStructuredDeenAIContext(
  endDateStr: string,
  daysLimit = 7
): Promise<DeenAIContext> {
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
  const [prayerLogs, routineLogs, allGoals] = await Promise.all([
    db.prayers.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.routines.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.goals.toArray()
  ]);

  const prayerMap = new Map(prayerLogs.map(p => [p.date, p]));
  const routinesGrouped = new Map<string, any[]>();
  routineLogs.forEach(r => {
    const arr = routinesGrouped.get(r.date) || [];
    arr.push(r);
    routinesGrouped.set(r.date, arr);
  });
  const deenGoals = allGoals.filter(g => g.category === 'deen' || (g as any).isDeen);
  const activeDeenGoals = deenGoals.filter(g => !g.completed);
  const completedDeenGoals = deenGoals.filter(g => g.completed);

  const prayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

  const perPrayerCounts: Record<string, { onTime: number; late: number; missed: number; tracked: number; applicable: number }> = {
    fajr: { onTime: 0, late: 0, missed: 0, tracked: 0, applicable: daysLimit },
    dhuhr: { onTime: 0, late: 0, missed: 0, tracked: 0, applicable: daysLimit },
    asr: { onTime: 0, late: 0, missed: 0, tracked: 0, applicable: daysLimit },
    maghrib: { onTime: 0, late: 0, missed: 0, tracked: 0, applicable: daysLimit },
    isha: { onTime: 0, late: 0, missed: 0, tracked: 0, applicable: daysLimit }
  };

  let onTimeTotal = 0;
  let lateTotal = 0;
  let missedTotal = 0;
  let quranMinsTotal = 0;
  let quranActiveDays = 0;
  let hasQuranLogs = false;

  for (const dateStr of dates) {
    const pLog = prayerMap.get(dateStr);
    const dayRoutines = routinesGrouped.get(dateStr) || [];

    if (pLog && pLog.quranMinutes !== undefined) {
      hasQuranLogs = true;
      const qMins = pLog.quranMinutes;
      quranMinsTotal += qMins;
      if (qMins > 0) quranActiveDays++;
    }

    prayerKeys.forEach(field => {
      let status: string | undefined = undefined;

      if (pLog && pLog[field] !== undefined) {
        status = getPrayerStatus(pLog[field]);
      } else {
        const rt = dayRoutines.find(r => r.taskName.toLowerCase() === field);
        if (rt) status = rt.completed ? 'prayed_on_time' : undefined;
      }

      if (status === 'prayed_on_time') {
        onTimeTotal++;
        perPrayerCounts[field].onTime++;
        perPrayerCounts[field].tracked++;
      } else if (status === 'prayed_late') {
        lateTotal++;
        perPrayerCounts[field].late++;
        perPrayerCounts[field].tracked++;
      } else if (status === 'missed') {
        missedTotal++;
        perPrayerCounts[field].missed++;
        perPrayerCounts[field].tracked++;
      }
    });
  }

  const latestLog = prayerMap.get(endDateStr);
  const latestRoutines = routinesGrouped.get(endDateStr) || [];
  const deenScoreDetail = await calculateDeenScore(endDateStr, latestLog, latestRoutines, allGoals.filter(g => !g.completed));

  const applicablePrayers = daysLimit * 5;
  const trackedPrayers = onTimeTotal + lateTotal + missedTotal;
  const coveragePercent = Math.round((trackedPrayers / applicablePrayers) * 100);

  const onTimeRate = trackedPrayers > 0 ? Math.round((onTimeTotal / trackedPrayers) * 100) : 0;
  const lateRate = trackedPrayers > 0 ? Math.round((lateTotal / trackedPrayers) * 100) : 0;
  const missedRate = trackedPrayers > 0 ? Math.round((missedTotal / trackedPrayers) * 100) : 0;

  const avgPerActive = quranActiveDays > 0 ? Number((quranMinsTotal / quranActiveDays).toFixed(1)) : 0;
  const avgPerCalendar = Number((quranMinsTotal / daysLimit).toFixed(1));

  const byPrayer = {
    fajr: {
      ...perPrayerCounts.fajr,
      onTimeCount: perPrayerCounts.fajr.onTime,
      lateCount: perPrayerCounts.fajr.late,
      missedCount: perPrayerCounts.fajr.missed,
      trackedCount: perPrayerCounts.fajr.tracked,
      applicableCount: perPrayerCounts.fajr.applicable,
      onTimeRate: perPrayerCounts.fajr.tracked > 0 ? Math.round((perPrayerCounts.fajr.onTime / perPrayerCounts.fajr.tracked) * 100) : 0
    },
    dhuhr: {
      ...perPrayerCounts.dhuhr,
      onTimeCount: perPrayerCounts.dhuhr.onTime,
      lateCount: perPrayerCounts.dhuhr.late,
      missedCount: perPrayerCounts.dhuhr.missed,
      trackedCount: perPrayerCounts.dhuhr.tracked,
      applicableCount: perPrayerCounts.dhuhr.applicable,
      onTimeRate: perPrayerCounts.dhuhr.tracked > 0 ? Math.round((perPrayerCounts.dhuhr.onTime / perPrayerCounts.dhuhr.tracked) * 100) : 0
    },
    asr: {
      ...perPrayerCounts.asr,
      onTimeCount: perPrayerCounts.asr.onTime,
      lateCount: perPrayerCounts.asr.late,
      missedCount: perPrayerCounts.asr.missed,
      trackedCount: perPrayerCounts.asr.tracked,
      applicableCount: perPrayerCounts.asr.applicable,
      onTimeRate: perPrayerCounts.asr.tracked > 0 ? Math.round((perPrayerCounts.asr.onTime / perPrayerCounts.asr.tracked) * 100) : 0
    },
    maghrib: {
      ...perPrayerCounts.maghrib,
      onTimeCount: perPrayerCounts.maghrib.onTime,
      lateCount: perPrayerCounts.maghrib.late,
      missedCount: perPrayerCounts.maghrib.missed,
      trackedCount: perPrayerCounts.maghrib.tracked,
      applicableCount: perPrayerCounts.maghrib.applicable,
      onTimeRate: perPrayerCounts.maghrib.tracked > 0 ? Math.round((perPrayerCounts.maghrib.onTime / perPrayerCounts.maghrib.tracked) * 100) : 0
    },
    isha: {
      ...perPrayerCounts.isha,
      onTimeCount: perPrayerCounts.isha.onTime,
      lateCount: perPrayerCounts.isha.late,
      missedCount: perPrayerCounts.isha.missed,
      trackedCount: perPrayerCounts.isha.tracked,
      applicableCount: perPrayerCounts.isha.applicable,
      onTimeRate: perPrayerCounts.isha.tracked > 0 ? Math.round((perPrayerCounts.isha.onTime / perPrayerCounts.isha.tracked) * 100) : 0
    }
  };

  return {
    dateRange: {
      startDate: startDateStr,
      endDate: endDateStr,
      days: daysLimit
    },
    prayerTracking: {
      applicablePrayers,
      trackedPrayers,
      coveragePercent,
      onTimeCount: onTimeTotal,
      lateCount: lateTotal,
      missedCount: missedTotal,
      onTimeRate,
      lateRate,
      missedRate,
      byPrayer
    },
    quran: {
      activeDays: quranActiveDays,
      totalMinutes: quranMinsTotal,
      averageMinutesPerActiveDay: avgPerActive,
      averageMinutesPerCalendarDay: avgPerCalendar,
      status: hasQuranLogs ? (quranMinsTotal > 0 ? 'tracked' : 'insufficient') : 'untracked'
    },
    deenScore: {
      score: deenScoreDetail.status !== 'insufficient' ? deenScoreDetail.score : undefined,
      status: deenScoreDetail.status as 'insufficient' | 'completed' | 'partial',
      trackedFactors: deenScoreDetail.trackedCount,
      totalFactors: 3
    },
    goals: {
      tracked: deenGoals.length > 0,
      activeCount: activeDeenGoals.length,
      completedCount: completedDeenGoals.length
    }
  };
}

export function formatDeenAIContextForPrompt(ctx: DeenAIContext): string {
  const p = ctx.prayerTracking;
  const q = ctx.quran;
  const s = ctx.deenScore;
  const g = ctx.goals;

  const lines: string[] = [
    `DEEN TRACKING CONTEXT`,
    `Analysis period: ${ctx.dateRange.startDate} to ${ctx.dateRange.endDate} (${ctx.dateRange.days} days)`,
    ``,
    `Prayer tracking:`,
    `- Applicable: ${p.applicablePrayers}`,
    `- Tracked: ${p.trackedPrayers}`,
    `- Coverage: ${p.coveragePercent}%`,
    `- On-time: ${p.onTimeCount} (${p.onTimeRate}%)`,
    `- Late: ${p.lateCount} (${p.lateRate}%)`,
    `- Explicitly recorded missed: ${p.missedCount} (${p.missedRate}%)`,
    `- Breakdown: Fajr (${p.byPrayer.fajr.onTimeCount}/${p.byPrayer.fajr.applicableCount}), Dhuhr (${p.byPrayer.dhuhr.onTimeCount}/${p.byPrayer.dhuhr.applicableCount}), Asr (${p.byPrayer.asr.onTimeCount}/${p.byPrayer.asr.applicableCount}), Maghrib (${p.byPrayer.maghrib.onTimeCount}/${p.byPrayer.maghrib.applicableCount}), Isha (${p.byPrayer.isha.onTimeCount}/${p.byPrayer.isha.applicableCount})`,
    ``,
    `Qur'an tracking:`,
    `- Status: ${q.status}`,
    q.status !== 'untracked'
      ? `- Active days: ${q.activeDays}\n- Total minutes: ${q.totalMinutes}\n- Avg per active day: ${q.averageMinutesPerActiveDay} min\n- Avg per calendar day: ${q.averageMinutesPerCalendarDay} min`
      : `- No Qur'an tracking data recorded in this period`,
    ``,
    `Deen consistency tracking:`,
    `- Status: ${s.status}`,
    s.score !== undefined ? `- Score: ${s.score}%` : `- Score: Untracked / Insufficient data`,
    `- Tracked factors: ${s.trackedFactors}/${s.totalFactors}`,
    ``,
    `Deen goals tracking:`,
    g.tracked ? `- Active goals: ${g.activeCount}, Completed: ${g.completedCount}` : `- No specific Deen goals active`,
    ``,
    `Important:`,
    `- Untracked prayer records are not treated as missed prayers.`,
    `- Missing Qur'an records are not treated as zero activity.`,
    `- Deen score is a habit-tracking metric, not a theological judgment.`
  ];

  return lines.join('\n');
}
