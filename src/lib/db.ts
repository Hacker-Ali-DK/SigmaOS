import Dexie, { type Table } from 'dexie';

export interface UserProfile {
  id: number;
  name: string;
  age?: number;
  avatarUrl?: string;
  dailyCalorieTarget: number;
  dailyWaterTarget: number; // in Liters
  dailySleepTarget: number; // in hours
  cleanStreak: number; // clean days streak counter
  dailyScreenTimeTarget?: number; //Configurable screen-time limit in hours
  // Step 3 settings
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  timezone?: string;
  prayerMethod?: 'karachi' | 'mwl' | 'umm_al_qura' | 'isna';
  asrMethod?: 'standard' | 'hanafi';
  ishaPolicy?: 'midnight' | 'fajr';
}

export type DetailedPrayerStatus =
  | 'prayed_on_time'
  | 'prayed_late'
  | 'missed'
  | 'not_tracked';

export interface PrayerDetail {
  status: DetailedPrayerStatus;
  scheduledTime?: string;
  completedTime?: string;
}

export interface PrayerCalculationContext {
  latitude: number;
  longitude: number;
  timezone: string;
  method: string;
  asrMethod: 'standard' | 'hanafi';
  ishaPolicy: 'midnight' | 'fajr';
}

export interface PrayerLog {
  id?: number;
  date: string; // YYYY-MM-DD
  fajr: PrayerDetail | DetailedPrayerStatus | boolean;
  dhuhr: PrayerDetail | DetailedPrayerStatus | boolean;
  asr: PrayerDetail | DetailedPrayerStatus | boolean;
  maghrib: PrayerDetail | DetailedPrayerStatus | boolean;
  isha: PrayerDetail | DetailedPrayerStatus | boolean;
  prayerStatuses?: DetailedPrayerStatus[];
  quranMinutes: number;
  calculationContext?: PrayerCalculationContext;
}

export function getPrayerStatus(val: any): DetailedPrayerStatus {
  if (val === true) return 'prayed_on_time';
  if (val === false) return 'not_tracked';
  if (typeof val === 'string') {
    if (val === 'prayed_on_time' || val === 'prayed_late' || val === 'missed' || val === 'not_tracked') {
      return val as DetailedPrayerStatus;
    }
  }
  if (typeof val === 'object' && val !== null && typeof val.status === 'string') {
    return val.status as DetailedPrayerStatus;
  }
  return 'not_tracked';
}

export function isPrayerCompleted(val: any): boolean {
  const status = getPrayerStatus(val);
  return status === 'prayed_on_time' || status === 'prayed_late';
}

export function normalizePrayerDetail(val: any): PrayerDetail {
  if (typeof val === 'object' && val !== null && typeof val.status === 'string') {
    const detail: PrayerDetail = {
      status: val.status as DetailedPrayerStatus
    };
    if (val.scheduledTime !== undefined) detail.scheduledTime = val.scheduledTime;
    if (val.completedTime !== undefined) detail.completedTime = val.completedTime;
    return detail;
  }
  return {
    status: getPrayerStatus(val)
  };
}

export function migrateLegacyPrayerLog(log: any): PrayerLog {
  if (!log) return log;

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  for (const name of prayerNames) {
    log[name] = normalizePrayerDetail(log[name]);
  }

  log.prayerStatuses = prayerNames.map(name => (log[name] as PrayerDetail).status);
  log.quranMinutes = typeof log.quranMinutes === 'number' ? log.quranMinutes : 0;

  if (!log.calculationContext) {
    delete log.calculationContext;
  }

  return log;
}


export interface DopamineUrge {
  id?: number;
  timestamp: number; // Unix timestamp
  strength: 'low' | 'medium' | 'high';
  triggers: string[];
  notes?: string;
  resisted?: boolean; // true = resisted, false = relapsed, undefined = unknown
}

export interface SleepLog {
  id?: number;
  date: string; // YYYY-MM-DD
  totalHours: number;
  deepHours?: number;
  lightHours?: number;
  remHours?: number;
  awakeHours?: number;
  qualityScore: number; // 1-100
  bedtime?: string;
  waketime?: string;
  qualityRating?: number; // 1-5
  awakenings?: number;
  notes?: string;
  source?: 'manual' | 'health_connect' | 'wearable' | 'imported';
}

export interface NapLog {
  id?: number;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  durationMinutes: number;
  qualityRating?: number; // 1-5
  notes?: string;
  source?: 'manual' | 'health_connect' | 'wearable' | 'imported';
}

export interface WaterLog {
  id?: number;
  date: string; // YYYY-MM-DD
  amountLiters: number;
}

export interface MealLog {
  id?: number;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  description: string;
  calories: number;
  proteinGrams: number;
}

export interface WorkoutLog {
  id?: number;
  date: string; // YYYY-MM-DD
  type: string;
  durationMinutes: number;
  intensity: 'low' | 'medium' | 'high';
}

export interface RoutineTask {
  id?: number;
  date: string; // YYYY-MM-DD
  taskName: string;
  timeLabel: string; // e.g. "6:00 PM"
  completed: boolean;
  order: number;
}

export interface Goal {
  id?: number;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  category: 'health' | 'deen' | 'habits' | 'career';
  completed: boolean;
  createdAt: number;
}

export interface JournalLog {
  id?: number;
  date: string; // YYYY-MM-DD
  text: string;
  mood: 'great' | 'good' | 'neutral' | 'anxious';
  energy?: 'low' | 'medium' | 'high';
  screenHours?: number; // Recreational screen hours
  productiveScreenHours?: number; // Productive screen hours
}

export interface WeightLog {
  id?: number;
  date: string; // YYYY-MM-DD
  weight: number;
}

export class RecoveryDB extends Dexie {
  userProfile!: Table<UserProfile>;
  prayers!: Table<PrayerLog>;
  dopamineUrges!: Table<DopamineUrge>;
  sleep!: Table<SleepLog>;
  water!: Table<WaterLog>;
  meals!: Table<MealLog>;
  workouts!: Table<WorkoutLog>;
  routines!: Table<RoutineTask>;
  goals!: Table<Goal>;
  journal!: Table<JournalLog>;
  weight!: Table<WeightLog>;
  naps!: Table<NapLog>;

  constructor() {
    super('RecoveryDB');
    this.version(1).stores({
      userProfile: 'id',
      prayers: '&date',
      dopamineUrges: '++id, timestamp, strength',
      sleep: '&date',
      water: '&date',
      meals: '++id, date, mealType',
      workouts: '++id, date',
      routines: '++id, [date+order], date',
      goals: '++id, category, completed',
    });
    this.version(2).stores({
      userProfile: 'id',
      prayers: '&date',
      dopamineUrges: '++id, timestamp, strength',
      sleep: '&date',
      water: '&date',
      meals: '++id, date, mealType',
      workouts: '++id, date',
      routines: '++id, [date+order], date',
      goals: '++id, category, completed',
      journal: '&date',
      weight: '&date',
    });
    this.version(3).stores({
      userProfile: 'id',
      prayers: '&date',
      dopamineUrges: '++id, timestamp, strength',
      sleep: '&date',
      water: '&date',
      meals: '++id, date, mealType',
      workouts: '++id, date',
      routines: '++id, [date+order], date',
      goals: '++id, category, completed',
      journal: '&date',
      weight: '&date',
    });
    this.version(4).stores({
      userProfile: 'id',
      prayers: '&date',
      dopamineUrges: '++id, timestamp, strength',
      sleep: '&date',
      water: '&date',
      meals: '++id, date, mealType',
      workouts: '++id, date',
      routines: '++id, [date+order], date',
      goals: '++id, category, completed',
      journal: '&date',
      weight: '&date',
      naps: '++id, date',
    });
    this.version(5).stores({
      userProfile: 'id',
      prayers: '&date',
      dopamineUrges: '++id, timestamp, strength',
      sleep: '&date',
      water: '&date',
      meals: '++id, date, mealType',
      workouts: '++id, date',
      routines: '++id, [date+order], date',
      goals: '++id, category, completed',
      journal: '&date',
      weight: '&date',
      naps: '++id, date',
    }).upgrade(async (tx) => {
      await tx.table('prayers').toCollection().modify((log: any) => {
        migrateLegacyPrayerLog(log);
      });
    });
  }
}

export const db = new RecoveryDB();
