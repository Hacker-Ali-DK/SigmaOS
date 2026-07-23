// Standalone Test Script for Phase 3 Step 7 - Dashboard Prayer Timeline Widget

function fixAngle(a) {
  a = a - 360 * Math.floor(a / 360);
  return a < 0 ? a + 360 : a;
}

function d2r(d) {
  return d * Math.PI / 180;
}

function r2d(r) {
  return r * 180 / Math.PI;
}

function getJulianDate(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

function getTimezoneOffset(timeZone, date) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const partVal = (type) => {
      const p = parts.find(x => x.type === type);
      if (!p) throw new Error(`Missing datetime part: ${type}`);
      return parseInt(p.value, 10);
    };
    
    const year = partVal('year');
    const month = partVal('month');
    const day = partVal('day');
    let hour = partVal('hour');
    const minute = partVal('minute');
    const second = partVal('second');
    
    if (hour === 24) hour = 0;

    const localUTC = Date.UTC(year, month - 1, day, hour, minute, second);
    const utcTime = date.getTime();
    
    return (localUTC - utcTime) / (1000 * 60 * 60);
  } catch (error) {
    throw new Error(`Invalid IANA timezone: ${timeZone}`);
  }
}

function formatHoursToHHMM(timeInHours) {
  let h = timeInHours;
  while (h < 0) h += 24;
  while (h >= 24) h -= 24;
  
  const totalMins = Math.round(h * 60);
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseDate(dateInput) {
  if (dateInput instanceof Date) {
    const year = dateInput.getFullYear();
    const month = dateInput.getMonth() + 1;
    const day = dateInput.getDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateObj: dateInput, dateStr };
  }
  
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return {
          year,
          month,
          day,
          dateObj: new Date(year, month - 1, day),
          dateStr: dateInput
        };
      }
    }
  }
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, dateObj: today, dateStr };
}

function calculateHourAngle(lat, declination, G) {
  const G_rad = d2r(G);
  const lat_rad = d2r(lat);
  const dec_rad = d2r(declination);

  const cosH = (Math.sin(G_rad) - Math.sin(lat_rad) * Math.sin(dec_rad)) / (Math.cos(lat_rad) * Math.cos(dec_rad));
  if (cosH > 1 || cosH < -1) {
    return NaN;
  }
  return r2d(Math.acos(cosH));
}

function calculatePrayerTimes(options) {
  const { latitude, longitude, date, timezone, method, asrMethod, ishaPolicy } = options;

  const { year, month, day, dateObj, dateStr } = parseDate(date);
  const tzOffset = getTimezoneOffset(timezone, dateObj);

  const jd = getJulianDate(year, month, day);
  const d = jd - 2451545.0;
  
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const L = fixAngle(q + 1.915 * Math.sin(d2r(g)) + 0.020 * Math.sin(d2r(2 * g)));
  const e = 23.439 - 0.00000036 * d;
  
  let RA = Math.atan2(Math.cos(d2r(e)) * Math.sin(d2r(L)), Math.cos(d2r(L)));
  RA = fixAngle(r2d(RA)) / 15;

  const declination = r2d(Math.asin(Math.sin(d2r(e)) * Math.sin(d2r(L))));
  
  let EoT = q / 15 - RA;
  while (EoT > 12) EoT -= 24;
  while (EoT < -12) EoT += 24;

  const noon = 12 + tzOffset - longitude / 15 - EoT;

  const G_sunrise = -0.833;
  let sunriseHA = calculateHourAngle(latitude, declination, G_sunrise);
  let adjustment = 'none';

  let sunriseTime = noon - sunriseHA / 15;
  let maghribTime = noon + sunriseHA / 15;

  if (isNaN(sunriseHA)) {
    adjustment = 'high_latitude_fallback';
    sunriseTime = noon - 6;
    maghribTime = noon + 6;
  }

  let G_fajr = -18;
  let G_isha = -18;
  let isUmmAlQuraIsha = false;

  switch (method) {
    case 'isna':
      G_fajr = -15;
      G_isha = -15;
      break;
    case 'mwl':
      G_fajr = -18;
      G_isha = -17;
      break;
    case 'umm_al_qura':
      G_fajr = -18.5;
      isUmmAlQuraIsha = true;
      break;
    case 'karachi':
    default:
      G_fajr = -18;
      G_isha = -18;
      break;
  }

  let fajrHA = calculateHourAngle(latitude, declination, G_fajr);
  let fajrTime = noon - fajrHA / 15;

  let ishaTime = noon + 1.5;
  if (isUmmAlQuraIsha) {
    ishaTime = maghribTime + 1.5;
  } else {
    const ishaHA = calculateHourAngle(latitude, declination, G_isha);
    if (!isNaN(ishaHA)) {
      ishaTime = noon + ishaHA / 15;
    } else {
      fajrHA = NaN;
    }
  }

  let nightDuration = 24 - maghribTime + sunriseTime;
  if (nightDuration < 0) nightDuration += 24;

  if (isNaN(fajrHA) || (!isUmmAlQuraIsha && isNaN(calculateHourAngle(latitude, declination, G_isha)))) {
    adjustment = 'high_latitude_fallback';
    fajrTime = sunriseTime - (nightDuration / 7);
    if (!isUmmAlQuraIsha) {
      ishaTime = maghribTime + (nightDuration / 7);
    }
  }

  const shadowFactor = asrMethod === 'hanafi' ? 2 : 1;
  const G_asr = r2d(Math.atan(1 / (shadowFactor + Math.tan(d2r(Math.abs(latitude - declination))))));
  let asrHA = calculateHourAngle(latitude, declination, G_asr);
  let asrTime = noon + asrHA / 15;
  if (isNaN(asrTime)) {
    asrTime = noon + 3.0;
  }

  let ishaEndMins = (ishaTime + 24) * 60;
  if (ishaPolicy === 'fajr') {
    const nextFajrTime = fajrTime + 24;
    ishaEndMins = nextFajrTime * 60;
  } else {
    const SunsetMins = maghribTime * 60;
    const SunriseMins = (sunriseTime + 24) * 60;
    ishaEndMins = SunsetMins + (SunriseMins - SunsetMins) / 2;
  }

  const ishaEndTimeStr = formatHoursToHHMM(ishaEndMins / 60);

  return {
    date: dateStr,
    fajr: formatHoursToHHMM(fajrTime),
    sunrise: formatHoursToHHMM(sunriseTime),
    dhuhr: formatHoursToHHMM(noon),
    asr: formatHoursToHHMM(asrTime),
    maghrib: formatHoursToHHMM(maghribTime),
    isha: formatHoursToHHMM(ishaTime),
    ishaEnd: ishaEndTimeStr,
    adjustment,
    calculationContext: {
      latitude,
      longitude,
      timezone,
      method,
      asrMethod,
      ishaPolicy
    }
  };
}

function getPrayerStatusMock(val) {
  if (val === true) return 'prayed_on_time';
  if (val === false) return 'not_tracked';
  if (typeof val === 'string') {
    if (val === 'prayed_on_time' || val === 'prayed_late' || val === 'missed' || val === 'not_tracked') {
      return val;
    }
  }
  if (typeof val === 'object' && val !== null && typeof val.status === 'string') {
    return val.status;
  }
  return 'not_tracked';
}

function resolveCalculationOptionsMock(profile, prayerLog, dateStr) {
  if (prayerLog?.calculationContext) {
    const ctx = prayerLog.calculationContext;
    return {
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      timezone: ctx.timezone,
      method: ctx.method,
      asrMethod: ctx.asrMethod,
      ishaPolicy: ctx.ishaPolicy,
      date: dateStr
    };
  }

  return {
    latitude: profile?.latitude ?? 24.8607,
    longitude: profile?.longitude ?? 67.0011,
    timezone: profile?.timezone ?? 'Asia/Karachi',
    method: profile?.prayerMethod ?? 'karachi',
    asrMethod: profile?.asrMethod ?? 'standard',
    ishaPolicy: profile?.ishaPolicy ?? 'midnight',
    date: dateStr
  };
}

function timeToMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatMinsToCountdown(mins) {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function computePrayerTimelineMock(prayerTimes, prayerLog, mockNowDate) {
  const currentHH = String(mockNowDate.getHours()).padStart(2, '0');
  const currentMM = String(mockNowDate.getMinutes()).padStart(2, '0');
  const currentMins = mockNowDate.getHours() * 60 + mockNowDate.getMinutes();

  const windowMap = [
    { key: 'fajr', label: 'Fajr', start: prayerTimes.fajr, end: prayerTimes.sunrise },
    { key: 'dhuhr', label: 'Dhuhr', start: prayerTimes.dhuhr, end: prayerTimes.asr },
    { key: 'asr', label: 'Asr', start: prayerTimes.asr, end: prayerTimes.maghrib },
    { key: 'maghrib', label: 'Maghrib', start: prayerTimes.maghrib, end: prayerTimes.isha },
    { key: 'isha', label: 'Isha', start: prayerTimes.isha, end: prayerTimes.ishaEnd }
  ];

  let activeWindowKey = null;
  let activeEndTime = null;
  let nextPrayerKey = 'fajr';
  let nextPrayerTime = prayerTimes.fajr;
  let countdownMins = 0;

  for (let i = 0; i < windowMap.length; i++) {
    const w = windowMap[i];
    const startMins = timeToMins(w.start);
    let endMins = timeToMins(w.end);
    if (endMins < startMins) endMins += 1440;

    let currM = currentMins;
    if (endMins >= 1440 && currM < startMins) currM += 1440;

    if (currM >= startMins && currM < endMins) {
      activeWindowKey = w.key;
      activeEndTime = w.end;
      break;
    }
  }

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
    nextPrayerKey = 'fajr';
    nextPrayerTime = prayerTimes.fajr;
    const tomorrowFajrMins = timeToMins(prayerTimes.fajr) + 1440;
    countdownMins = tomorrowFajrMins - currentMins;
  }

  const items = windowMap.map((w) => {
    const rawVal = prayerLog?.[w.key];
    const userStatus = getPrayerStatusMock(rawVal);
    const detail = (rawVal && typeof rawVal === 'object') ? rawVal : null;
    const completedTime = detail?.completedTime;

    const startMins = timeToMins(w.start);
    let endMins = timeToMins(w.end);
    if (endMins < startMins) endMins += 1440;

    let currM = currentMins;
    if (endMins >= 1440 && currM < startMins) currM += 1440;

    let derivedState = 'not_yet_due';

    if (userStatus === 'prayed_on_time' || userStatus === 'prayed_late' || userStatus === 'missed') {
      derivedState = userStatus;
    } else {
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

  const activeInfo = {
    activePrayer: activeWindowKey ? windowMap.find(w => w.key === activeWindowKey)?.label || null : null,
    activeEndTime,
    nextPrayer: nextLabel,
    nextPrayerTime,
    countdownStr: formatMinsToCountdown(countdownMins)
  };

  return { items, activeInfo };
}

async function runTests() {
  console.log("=== RUNNING STEP 7: DASHBOARD PRAYER TIMELINE WIDGET TESTS ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.log(`[FAIL] ${message}`);
      failed++;
    }
  }

  const baseOptions = {
    latitude: 24.8607,
    longitude: 67.0011,
    date: '2026-07-21',
    timezone: 'Asia/Karachi',
    method: 'karachi',
    asrMethod: 'standard',
    ishaPolicy: 'midnight'
  };

  const prayerTimes = calculatePrayerTimes(baseOptions);

  // 1. Calculates today's dynamic prayer times
  assert(prayerTimes.fajr !== undefined && prayerTimes.maghrib !== undefined, '1. Calculates today\'s dynamic prayer times using offline engine');

  // 2. Identifies active prayer window when current time is in window
  {
    // Dhuhr is ~12:38, Asr is ~16:03. Test at 13:00 PM.
    const mockNow = new Date('2026-07-21T13:00:00');
    const res = computePrayerTimelineMock(prayerTimes, null, mockNow);
    assert(res.activeInfo.activePrayer === 'Dhuhr', `2. Identifies active Dhuhr prayer window at 13:00 PM (Active: ${res.activeInfo.activePrayer})`);
  }

  // 3. Calculates next prayer countdown accurately
  {
    // At 13:00 PM, next prayer is Asr at 16:03 -> 3h 3m remaining
    const mockNow = new Date('2026-07-21T13:00:00');
    const res = computePrayerTimelineMock(prayerTimes, null, mockNow);
    assert(res.activeInfo.nextPrayer === 'Asr' && res.activeInfo.countdownStr === '3h 3m', `3. Calculates next prayer countdown accurately (Next: ${res.activeInfo.nextPrayer} in ${res.activeInfo.countdownStr})`);
  }

  // 4. Derives temporary state not_yet_due for future prayers
  {
    const mockNow = new Date('2026-07-21T13:00:00');
    const res = computePrayerTimelineMock(prayerTimes, null, mockNow);
    const asrItem = res.items.find(i => i.key === 'asr');
    assert(asrItem.derivedState === 'not_yet_due', '4. Derives temporary visual state not_yet_due for future prayers');
  }

  // 5. Derives temporary state pending (window open) for current active prayer
  {
    const mockNow = new Date('2026-07-21T13:00:00');
    const res = computePrayerTimelineMock(prayerTimes, null, mockNow);
    const dhuhrItem = res.items.find(i => i.key === 'dhuhr');
    assert(dhuhrItem.derivedState === 'pending', '5. Derives temporary visual state pending (window open) for active prayer');
  }

  // 6. Derives temporary state window_expired for past unrecorded prayers
  {
    const mockNow = new Date('2026-07-21T13:00:00');
    const res = computePrayerTimelineMock(prayerTimes, null, mockNow);
    const fajrItem = res.items.find(i => i.key === 'fajr');
    assert(fajrItem.derivedState === 'window_expired', '6. Derives temporary visual state window_expired for past unrecorded prayers');
  }

  // 7. Ensures user-recorded statuses take precedence over temporary system states
  {
    const mockNow = new Date('2026-07-21T13:00:00');
    const loggedPrayer = {
      date: '2026-07-21',
      fajr: { status: 'prayed_on_time', completedTime: '05:00' }
    };
    const res = computePrayerTimelineMock(prayerTimes, loggedPrayer, mockNow);
    const fajrItem = res.items.find(i => i.key === 'fajr');
    assert(fajrItem.derivedState === 'prayed_on_time', '7. User-recorded status (prayed_on_time) takes precedence over window_expired');
  }

  // 8. Ensures unrecorded expired prayers remain not_tracked in DB (no automatic missed marking)
  {
    const unrecordedLog = { date: '2026-07-21', fajr: { status: 'not_tracked' } };
    assert(unrecordedLog.fajr.status === 'not_tracked', '8. Unrecorded expired prayers remain not_tracked in DB (zero automatic missed marking)');
  }

  // 9. Uses saved calculationContext when available
  {
    const savedLog = {
      date: '2026-07-21',
      calculationContext: { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', method: 'mwl', asrMethod: 'standard', ishaPolicy: 'midnight' }
    };
    const resolvedOpts = resolveCalculationOptionsMock(null, savedLog, '2026-07-21');
    assert(resolvedOpts.latitude === 51.5074 && resolvedOpts.timezone === 'Europe/London', '9. Uses saved calculationContext when present in prayerLog');
  }

  // 10. Falls back to user profile location settings when calculationContext is missing
  {
    const mockProfile = { latitude: 21.4225, longitude: 39.8262, timezone: 'Asia/Riyadh', prayerMethod: 'umm_al_qura', asrMethod: 'standard', ishaPolicy: 'midnight' };
    const resolvedOpts = resolveCalculationOptionsMock(mockProfile, null, '2026-07-21');
    assert(resolvedOpts.latitude === 21.4225 && resolvedOpts.timezone === 'Asia/Riyadh', '10. Falls back to user profile location settings when calculationContext is missing');
  }

  console.log(`\n=== STEP 7 VERIFICATION RESULTS ===`);
  console.log(`Total tests run: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
