import Dexie, { type Table } from 'dexie';

export interface UserProfile {
  id: number;
  name: string;
  avatarUrl?: string;
  dailyCalorieTarget: number;
  dailyWaterTarget: number; // in Liters
  dailySleepTarget: number; // in hours
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
}

export interface SleepLog {
  id?: number;
  date: string; // YYYY-MM-DD
  totalHours: number;
  deepHours: number;
  lightHours: number;
  remHours: number;
  awakeHours: number;
  qualityScore: number; // 1-100
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
  }
}

export const db = new RecoveryDB();
