import { db, getPrayerStatus } from '../db';
import { calculateDeenScore } from '../scoring/scoring-service';

export interface PerPrayerStat {
  key: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
  name: string;
  onTimeCount: number;
  lateCount: number;
  missedCount: number;
  trackedCount: number;
  applicableCount: number;
  onTimePercent: number;
  trackedPercent: number;
}

export interface QuranTrendEntry {
  date: string;
  displayDate: string;
  minutes: number;
}

export interface DeenScoreHistoryEntry {
  date: string;
  displayDate: string;
  score: number;
}

export interface DeenAnalyticsResult {
  daysLimit: number;
  applicablePrayers: number;
  trackedPrayers: number;
  coveragePercent: number;
  onTimeCount: number;
  lateCount: number;
  missedCount: number;
  untrackedCount: number;
  onTimeRate: number;
  lateRate: number;
  missedRate: number;
  avgQuranMinutes: number;
  quranActiveDays: number;
  perPrayerStats: PerPrayerStat[];
  quranTrend: QuranTrendEntry[];
  scoreHistory: DeenScoreHistoryEntry[];
}

export async function calculateDeenAnalyticsForRange(
  endDateStr: string,
  daysLimit = 7
): Promise<DeenAnalyticsResult> {
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
  const activeGoals = allGoals.filter(g => !g.completed);

  const prayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  const prayerNamesMap = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

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

  const quranTrend: QuranTrendEntry[] = [];
  const scoreHistory: DeenScoreHistoryEntry[] = [];

  for (const dateStr of dates) {
    const pLog = prayerMap.get(dateStr);
    const dayRoutines = routinesGrouped.get(dateStr) || [];

    // Calculate daily deen score for history trend
    const deenScoreDetail = await calculateDeenScore(dateStr, pLog, dayRoutines, activeGoals);

    let displayDate = dateStr;
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      displayDate = daysLimit <= 7
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } catch (e) {}

    scoreHistory.push({
      date: dateStr,
      displayDate,
      score: deenScoreDetail.status !== 'insufficient' ? deenScoreDetail.score : 60
    });

    // Qur'an minutes
    const qMins = pLog?.quranMinutes ?? 0;
    quranMinsTotal += qMins;
    if (qMins > 0) quranActiveDays++;
    quranTrend.push({ date: dateStr, displayDate, minutes: qMins });

    // Prayers
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

  const applicablePrayers = daysLimit * 5;
  const trackedPrayers = onTimeTotal + lateTotal + missedTotal;
  const untrackedCount = Math.max(0, applicablePrayers - trackedPrayers);
  const coveragePercent = Math.round((trackedPrayers / applicablePrayers) * 100);

  const onTimeRate = trackedPrayers > 0 ? Math.round((onTimeTotal / trackedPrayers) * 100) : 0;
  const lateRate = trackedPrayers > 0 ? Math.round((lateTotal / trackedPrayers) * 100) : 0;
  const missedRate = trackedPrayers > 0 ? Math.round((missedTotal / trackedPrayers) * 100) : 0;
  const avgQuranMinutes = Number((quranMinsTotal / daysLimit).toFixed(1));

  const perPrayerStats: PerPrayerStat[] = prayerKeys.map(k => {
    const c = perPrayerCounts[k];
    const onTimePercent = c.tracked > 0 ? Math.round((c.onTime / c.tracked) * 100) : 0;
    const trackedPercent = Math.round((c.tracked / c.applicable) * 100);

    return {
      key: k,
      name: prayerNamesMap[k],
      onTimeCount: c.onTime,
      lateCount: c.late,
      missedCount: c.missed,
      trackedCount: c.tracked,
      applicableCount: c.applicable,
      onTimePercent,
      trackedPercent
    };
  });

  return {
    daysLimit,
    applicablePrayers,
    trackedPrayers,
    coveragePercent,
    onTimeCount: onTimeTotal,
    lateCount: lateTotal,
    missedCount: missedTotal,
    untrackedCount,
    onTimeRate,
    lateRate,
    missedRate,
    avgQuranMinutes,
    quranActiveDays,
    perPrayerStats,
    quranTrend,
    scoreHistory
  };
}
