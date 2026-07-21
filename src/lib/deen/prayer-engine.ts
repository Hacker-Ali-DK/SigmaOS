/**
 * Recovery+ Standalone Offline Prayer-Time Engine (Phase 3)
 * Implements solar calculation formulas to compute Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha.
 * Operates offline, independent of external APIs or database tables.
 */

export interface PrayerCalculationOptions {
  latitude: number;
  longitude: number;
  date: Date | string;
  timezone: string; // IANA timezone e.g. "Asia/Karachi"
  method: 'karachi' | 'mwl' | 'umm_al_qura' | 'isna';
  asrMethod: 'standard' | 'hanafi';
  ishaPolicy: 'midnight' | 'fajr';
}

export interface PrayerTimes {
  date: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  ishaEnd: string;
  adjustment: 'none' | 'high_latitude_fallback';
  calculationContext: {
    latitude: number;
    longitude: number;
    timezone: string;
    method: 'karachi' | 'mwl' | 'umm_al_qura' | 'isna';
    asrMethod: 'standard' | 'hanafi';
    ishaPolicy: 'midnight' | 'fajr';
  };
}

// Coordinate conversions
function fixAngle(a: number): number {
  a = a - 360 * Math.floor(a / 360);
  return a < 0 ? a + 360 : a;
}

function d2r(d: number): number {
  return d * Math.PI / 180;
}

function r2d(r: number): number {
  return r * 180 / Math.PI;
}

// Julian Date helper
function getJulianDate(year: number, month: number, day: number): number {
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

// Time offset helper using Intl API
export function getTimezoneOffset(timeZone: string, date: Date): number {
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
    const partVal = (type: string) => {
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

// Format double hours to HH:MM string
export function formatHoursToHHMM(timeInHours: number): string {
  let h = timeInHours;
  while (h < 0) h += 24;
  while (h >= 24) h -= 24;
  
  const totalMins = Math.round(h * 60);
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseDate(dateInput: Date | string): { year: number; month: number; day: number; dateObj: Date; dateStr: string } {
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

// Calculate Hour Angle for a given altitude angle G (in degrees)
function calculateHourAngle(lat: number, declination: number, G: number): number {
  const G_rad = d2r(G);
  const lat_rad = d2r(lat);
  const dec_rad = d2r(declination);

  const cosH = (Math.sin(G_rad) - Math.sin(lat_rad) * Math.sin(dec_rad)) / (Math.cos(lat_rad) * Math.cos(dec_rad));
  if (cosH > 1 || cosH < -1) {
    return NaN; // Altitude never reached
  }
  return r2d(Math.acos(cosH));
}

// Primary calculation function
export function calculatePrayerTimes(options: PrayerCalculationOptions): PrayerTimes {
  const { latitude, longitude, date, timezone, method, asrMethod, ishaPolicy } = options;

  // Validate coordinates
  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude value: ${latitude}. Must be between -90 and 90.`);
  }
  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude value: ${longitude}. Must be between -180 and 180.`);
  }

  const { year, month, day, dateObj, dateStr } = parseDate(date);
  const tzOffset = getTimezoneOffset(timezone, dateObj);

  // Solar coordinates calculations
  const jd = getJulianDate(year, month, day);
  const d = jd - 2451545.0;
  
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const L = fixAngle(q + 1.915 * Math.sin(d2r(g)) + 0.020 * Math.sin(d2r(2 * g)));
  const e = 23.439 - 0.00000036 * d;
  
  let RA = Math.atan2(Math.cos(d2r(e)) * Math.sin(d2r(L)), Math.cos(d2r(L)));
  RA = fixAngle(r2d(RA)) / 15; // in hours

  const declination = r2d(Math.asin(Math.sin(d2r(e)) * Math.sin(d2r(L))));
  
  let EoT = q / 15 - RA;
  while (EoT > 12) EoT -= 24;
  while (EoT < -12) EoT += 24;

  // Midday (solar noon) clock time
  const noon = 12 + tzOffset - longitude / 15 - EoT;

  // Sunrise / Sunset altitude (standard atmospheric correction is -0.833 degrees)
  const G_sunrise = -0.833;
  let sunriseHA = calculateHourAngle(latitude, declination, G_sunrise);
  let adjustment: 'none' | 'high_latitude_fallback' = 'none';

  let sunriseTime = noon - sunriseHA / 15;
  let maghribTime = noon + sunriseHA / 15;

  // High-latitude safe defaults for Sunrise/Sunset
  if (isNaN(sunriseHA)) {
    adjustment = 'high_latitude_fallback';
    // If polar day/night, estimate based on average solar positions
    sunriseTime = noon - 6;
    maghribTime = noon + 6;
  }

  // Resolve method conventions
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

  // Calculate Fajr
  let fajrHA = calculateHourAngle(latitude, declination, G_fajr);
  let fajrTime = noon - fajrHA / 15;

  // Calculate Isha
  let ishaTime = noon + 1.5; // default Maghrib + 90 min fallback
  if (isUmmAlQuraIsha) {
    ishaTime = maghribTime + 1.5; // Exactly 90 minutes after Sunset
  } else {
    const ishaHA = calculateHourAngle(latitude, declination, G_isha);
    if (!isNaN(ishaHA)) {
      ishaTime = noon + ishaHA / 15;
    } else {
      // Fallback
      fajrHA = NaN; // force high-latitude adjustment for Fajr as well
    }
  }

  // Night duration for high-latitude fallbacks (One-Seventh of the Night)
  let nightDuration = 24 - maghribTime + sunriseTime;
  if (nightDuration < 0) nightDuration += 24;

  if (isNaN(fajrHA) || (!isUmmAlQuraIsha && isNaN(calculateHourAngle(latitude, declination, G_isha)))) {
    adjustment = 'high_latitude_fallback';
    // Limit Fajr/Isha twilight to 1/7th of the night
    fajrTime = sunriseTime - (nightDuration / 7);
    if (!isUmmAlQuraIsha) {
      ishaTime = maghribTime + (nightDuration / 7);
    }
  }

  // Asr Shadow Factor Calculations
  const shadowFactor = asrMethod === 'hanafi' ? 2 : 1;
  const G_asr = r2d(Math.atan(1 / (shadowFactor + Math.tan(d2r(Math.abs(latitude - declination))))));
  let asrHA = calculateHourAngle(latitude, declination, G_asr);
  let asrTime = noon + asrHA / 15;
  if (isNaN(asrTime)) {
    asrTime = noon + 3.0; // Safe default for polar conditions
  }

  // Isha End Window Calculations
  // Midnight policy: Sunset + (Next Sunrise - Sunset) / 2
  // Fajr policy: Next Fajr (estimated for tomorrow by adding 24 hours to today's Fajr)
  let ishaEndMins = (ishaTime + 24) * 60; // baseline fallback
  if (ishaPolicy === 'fajr') {
    // Isha ends at the next day's Fajr start time
    const nextFajrTime = fajrTime + 24;
    ishaEndMins = nextFajrTime * 60;
  } else {
    // Midnight Policy
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
