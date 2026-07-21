import { create } from 'zustand';
import { db, type UserProfile, type Goal, type RoutineTask, type SleepLog, type WaterLog, type MealLog, type PrayerLog } from './db';
import { type DailyScores } from './scoring/types';
import { calculateScoresForDate } from './scoring/scoring-service';

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
  getDailyScoresForDate: (date: string) => Promise<DailyScores>;
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

  getDailyScoresForDate: async (date) => {
    return calculateScoresForDate(date);
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
