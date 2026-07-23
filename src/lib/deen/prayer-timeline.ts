import { calculatePrayerTimes, type PrayerTimes, type PrayerCalculationOptions } from './prayer-engine';
import { type PrayerLog, type UserProfile, type DetailedPrayerStatus, getPrayerStatus, type PrayerDetail } from '../db';

export type DerivedPrayerState =
  | 'prayed_on_time'
  | 'prayed_late'
  | 'missed'
  | 'not_yet_due'
  | 'pending'
  | 'window_expired';

export interface TimelinePrayerItem {
  key: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
  label: string;
  timeStr: string;
  endTimeStr: string;
  userStatus: DetailedPrayerStatus;
  derivedState: DerivedPrayerState;
  isCurrentWindow: boolean;
  isNext: boolean;
  completedTime?: string;
}

export interface ActiveWindowAndCountdown {
  activePrayer: string | null;
  activeEndTime: string | null;
  nextPrayer: string;
  nextPrayerTime: string;
  countdownStr: string;
}

export function resolveCalculationOptions(profile: Partial<UserProfile> | null | undefined, prayerLog: PrayerLog | null | undefined, dateStr: string): PrayerCalculationOptions {
  if (prayerLog?.calculationContext) {
    const ctx = prayerLog.calculationContext;
    return {
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      timezone: ctx.timezone,
      method: ctx.method as any,
      asrMethod: ctx.asrMethod,
      ishaPolicy: ctx.ishaPolicy,
      date: dateStr
    };
  }

  return {
    latitude: profile?.latitude ?? 24.8607,
    longitude: profile?.longitude ?? 67.0011,
    timezone: profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Karachi',
    method: profile?.prayerMethod ?? 'karachi',
    asrMethod: profile?.asrMethod ?? 'standard',
    ishaPolicy: profile?.ishaPolicy ?? 'midnight',
    date: dateStr
  };
}

function timeToMins(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatMinsToCountdown(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function computePrayerTimeline(
  prayerTimes: PrayerTimes,
  prayerLog: PrayerLog | null | undefined,
  now = new Date()
): { items: TimelinePrayerItem[]; activeInfo: ActiveWindowAndCountdown } {
  const currentHH = String(now.getHours()).padStart(2, '0');
  const currentMM = String(now.getMinutes()).padStart(2, '0');
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const windowMap = [
    { key: 'fajr' as const, label: 'Fajr', start: prayerTimes.fajr, end: prayerTimes.sunrise },
    { key: 'dhuhr' as const, label: 'Dhuhr', start: prayerTimes.dhuhr, end: prayerTimes.asr },
    { key: 'asr' as const, label: 'Asr', start: prayerTimes.asr, end: prayerTimes.maghrib },
    { key: 'maghrib' as const, label: 'Maghrib', start: prayerTimes.maghrib, end: prayerTimes.isha },
    { key: 'isha' as const, label: 'Isha', start: prayerTimes.isha, end: prayerTimes.ishaEnd }
  ];

  // Determine current active window and next upcoming prayer
  let activeWindowKey: string | null = null;
  let activeEndTime: string | null = null;
  let nextPrayerKey: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' = 'fajr';
  let nextPrayerTime = prayerTimes.fajr;
  let countdownMins = 0;

  // Find active window
  for (let i = 0; i < windowMap.length; i++) {
    const w = windowMap[i];
    const startMins = timeToMins(w.start);
    let endMins = timeToMins(w.end);
    if (endMins < startMins) endMins += 1440; // crosses midnight

    let currM = currentMins;
    if (endMins >= 1440 && currM < startMins) currM += 1440;

    if (currM >= startMins && currM < endMins) {
      activeWindowKey = w.key;
      activeEndTime = w.end;
      break;
    }
  }

  // Find next upcoming prayer
  let foundNext = false;
  for (let i = 0; i < windowMap.length; i++) {
    const w = windowMap[i];
    const startMins = timeToMins(w.start);
    if (currentMins < startMins) {
      nextPrayerKey = w.key;
      nextPrayerTime = w.start;
      countdownMins = startMins - currentMins;
      foundNext = true;
      break;
    }
  }

  if (!foundNext) {
    // Next prayer is tomorrow's Fajr
    nextPrayerKey = 'fajr';
    nextPrayerTime = prayerTimes.fajr;
    const tomorrowFajrMins = timeToMins(prayerTimes.fajr) + 1440;
    countdownMins = tomorrowFajrMins - currentMins;
  }

  const items: TimelinePrayerItem[] = windowMap.map((w) => {
    const rawVal = prayerLog?.[w.key];
    const userStatus = getPrayerStatus(rawVal);
    const detail = (rawVal && typeof rawVal === 'object') ? (rawVal as PrayerDetail) : null;
    const completedTime = detail?.completedTime;

    const startMins = timeToMins(w.start);
    let endMins = timeToMins(w.end);
    if (endMins < startMins) endMins += 1440;

    let currM = currentMins;
    if (endMins >= 1440 && currM < startMins) currM += 1440;

    let derivedState: DerivedPrayerState = 'not_yet_due';

    if (userStatus === 'prayed_on_time' || userStatus === 'prayed_late' || userStatus === 'missed') {
      derivedState = userStatus;
    } else {
      // Temporary UI state for untracked prayer
      if (currM < startMins) {
        derivedState = 'not_yet_due';
      } else if (currM >= startMins && currM < endMins) {
        derivedState = 'pending';
      } else {
        derivedState = 'window_expired';
      }
    }

    return {
      key: w.key,
      label: w.label,
      timeStr: w.start,
      endTimeStr: w.end,
      userStatus,
      derivedState,
      isCurrentWindow: activeWindowKey === w.key,
      isNext: nextPrayerKey === w.key,
      completedTime
    };
  });

  const nextLabel = windowMap.find(w => w.key === nextPrayerKey)?.label || 'Fajr';

  const activeInfo: ActiveWindowAndCountdown = {
    activePrayer: activeWindowKey ? windowMap.find(w => w.key === activeWindowKey)?.label || null : null,
    activeEndTime,
    nextPrayer: nextLabel,
    nextPrayerTime,
    countdownStr: formatMinsToCountdown(countdownMins)
  };

  return { items, activeInfo };
}
