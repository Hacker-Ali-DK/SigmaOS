import { create } from 'zustand';
import { db, type UserProfile, type Goal, type RoutineTask, type SleepLog, type WaterLog, type MealLog, type PrayerLog } from './db';

interface AppState {
  currentTab: 'home' | 'progress' | 'add' | 'coach' | 'profile';
  selectedDate: string; // YYYY-MM-DD
  showAddModal: boolean;
  isInitialized: boolean;
  showOnboarding: boolean;
  setTab: (tab: 'home' | 'progress' | 'add' | 'coach' | 'profile') => void;
  setSelectedDate: (date: string) => void;
  setShowAddModal: (show: boolean) => void;
  initializeDb: () => Promise<void>;
  completeOnboarding: (data: {
    name: string;
    age: number;
    currentWeight: number;
    targetWeight: number;
    cleanStreak: number;
    sleepTarget: number;
  }) => Promise<void>;
  calculateRecoveryScoreForDate: (date: string) => Promise<number>;
}

// Helper to get date string in YYYY-MM-DD local format
export function getLocalDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'home',
  selectedDate: getLocalDateString(),
  showAddModal: false,
  isInitialized: false,
  showOnboarding: false,

  setTab: (tab) => set({ currentTab: tab }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setShowAddModal: (show) => set({ showAddModal: show }),

  calculateRecoveryScoreForDate: async (date) => {
    // 1. Sleep Quality (30%)
    const sleep = await db.sleep.get(date);
    const sleepScore = sleep ? Math.min((sleep.totalHours / 8) * 100, 100) * 0.7 + (sleep.qualityScore * 0.3) : 60; // default to 60 if no log

    // 2. Prayer/Deen Completion (20%)
    const prayers = await db.prayers.get(date);
    let prayerScore = 50; // baseline
    if (prayers) {
      let completedCount = 0;
      if (prayers.fajr) completedCount++;
      if (prayers.dhuhr) completedCount++;
      if (prayers.asr) completedCount++;
      if (prayers.maghrib) completedCount++;
      if (prayers.isha) completedCount++;
      prayerScore = (completedCount / 5) * 100;
    }

    // 3. Dopamine Recovery Streak (15%)
    const profile = await db.userProfile.get(1);
    const cleanDays = profile?.cleanStreak ?? 0;
    const dopamineScore = Math.min((cleanDays / 90) * 100, 100);

    // 4. Hydration (10%)
    const water = await db.water.get(date);
    const waterScore = water ? Math.min((water.amountLiters / 3.0) * 100, 100) : 0;

    // 5. Routine Completion (15%)
    const routines = await db.routines.where({ date }).toArray();
    let routineScore = 50;
    if (routines.length > 0) {
      const completed = routines.filter(r => r.completed).length;
      routineScore = (completed / routines.length) * 100;
    }

    // 6. Nutrition (10%)
    const meals = await db.meals.where({ date }).toArray();
    const calories = meals.reduce((sum, m) => sum + m.calories, 0);
    const protein = meals.reduce((sum, m) => sum + m.proteinGrams, 0);
    
    const calorieScore = Math.max(0, 100 - Math.abs((calories - 2500) / 2500) * 100);
    const proteinScore = Math.min((protein / 120) * 100, 100);
    const nutritionScore = (calorieScore + proteinScore) / 2;

    // Calculate final weighted score
    const finalScore = Math.round(
      (sleepScore * 0.3) +
      (prayerScore * 0.2) +
      (dopamineScore * 0.15) +
      (waterScore * 0.1) +
      (routineScore * 0.15) +
      (nutritionScore * 0.1)
    );

    return Math.max(10, Math.min(finalScore, 100));
  },

  initializeDb: async () => {
    const profile = await db.userProfile.get(1);
    if (profile) {
      set({ isInitialized: true, showOnboarding: false });
      return;
    }
    // No profile exists, show onboarding first
    set({ isInitialized: true, showOnboarding: true });
  },

  completeOnboarding: async (data) => {
    // 1. Create user profile in DB
    await db.userProfile.put({
      id: 1,
      name: data.name.trim() || 'Abdullah',
      age: data.age || 23,
      dailyCalorieTarget: 2500,
      dailyWaterTarget: 3.0,
      dailySleepTarget: data.sleepTarget || 8.0,
      cleanStreak: data.cleanStreak || 0
    });

    // 2. Create goals based on user input
    await db.goals.clear();
    await db.goals.add({
      title: "Gain Weight",
      targetValue: data.targetWeight || 75,
      currentValue: data.currentWeight || 69,
      unit: "kg",
      category: "health",
      completed: false,
      createdAt: Date.now()
    });
    await db.goals.add({
      title: "Clean Streak",
      targetValue: 90,
      currentValue: data.cleanStreak || 0,
      unit: "days",
      category: "health",
      completed: false,
      createdAt: Date.now()
    });
    await db.goals.add({
      title: "Wake up for Fajr",
      targetValue: 30,
      currentValue: 0,
      unit: "days",
      category: "deen",
      completed: false,
      createdAt: Date.now()
    });
    await db.goals.add({
      title: "Read 12 Books",
      targetValue: 12,
      currentValue: 0,
      unit: "Books",
      category: "habits",
      completed: false,
      createdAt: Date.now()
    });

    // 3. Create active routine list for today
    const targetDate = getLocalDateString(0);
    await db.routines.where({ date: targetDate }).delete();

    const initialRoutines = [
      { taskName: "Fajr", timeLabel: "5:05 AM", completed: false, order: 1 },
      { taskName: "Qur'an", timeLabel: "15 min", completed: false, order: 2 },
      { taskName: "Workout", timeLabel: "30 min", completed: false, order: 3 },
      { taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: false, order: 4 },
      { taskName: "Dhuhr", timeLabel: "1:15 PM", completed: false, order: 5 },
      { taskName: "Lunch", timeLabel: "1:45 PM", completed: false, order: 6 },
      { taskName: "Asr", timeLabel: "5:00 PM", completed: false, order: 7 },
      { taskName: "Walk", timeLabel: "6:00 PM", completed: false, order: 8 },
      { taskName: "Maghrib", timeLabel: "7:24 PM", completed: false, order: 9 },
      { taskName: "Isha", timeLabel: "8:41 PM", completed: false, order: 10 },
      { taskName: "Read Book", timeLabel: "Pending", completed: false, order: 11 },
      { taskName: "Sleep", timeLabel: "10:30 PM", completed: false, order: 12 }
    ];

    for (const r of initialRoutines) {
      await db.routines.add({
        date: targetDate,
        taskName: r.taskName,
        timeLabel: r.timeLabel,
        completed: false,
        order: r.order
      });
    }

    set({ showOnboarding: false });
  }
}));
