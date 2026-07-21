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

export interface PrayerLog {
  id?: number;
  date: string; // YYYY-MM-DD
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  quranMinutes: number;
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
  }
}

export const db = new RecoveryDB();
