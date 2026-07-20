import { create } from 'zustand';
import { db, type UserProfile, type Goal, type RoutineTask, type SleepLog, type WaterLog, type MealLog, type PrayerLog } from './db';

interface AppState {
  currentTab: 'home' | 'progress' | 'add' | 'coach' | 'profile';
  selectedDate: string; // YYYY-MM-DD
  showAddModal: boolean;
  isInitialized: boolean;
  setTab: (tab: 'home' | 'progress' | 'add' | 'coach' | 'profile') => void;
  setSelectedDate: (date: string) => void;
  setShowAddModal: (show: boolean) => void;
  initializeDb: () => Promise<void>;
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
    // Let's assume a baseline score based on days clean (from user profile or streak)
    const CleanDays = 45; // baseline clean days
    const dopamineScore = Math.min((CleanDays / 90) * 100, 100);

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
      set({ isInitialized: true });
      return;
    }

    // 1. Seed user profile
    await db.userProfile.put({
      id: 1,
      name: "Abdullah",
      dailyCalorieTarget: 2500,
      dailyWaterTarget: 3.0,
      dailySleepTarget: 8.0,
    });

    // 2. Seed active goals
    const initialGoals: Goal[] = [
      { title: "Gain Weight", targetValue: 75, currentValue: 69, unit: "kg", category: "health", completed: false, createdAt: Date.now() },
      { title: "Learn Flutter", targetValue: 100, currentValue: 65, unit: "%", category: "career", completed: false, createdAt: Date.now() },
      { title: "Read 12 Books", targetValue: 12, currentValue: 7, unit: "Books", category: "habits", completed: false, createdAt: Date.now() },
      { title: "Wake up for Fajr", targetValue: 30, currentValue: 25, unit: "days", category: "deen", completed: false, createdAt: Date.now() }
    ];
    await db.goals.clear();
    for (const g of initialGoals) {
      await db.goals.add(g);
    }

    // 3. Seed historical logs for the last 7 days (including today)
    const triggers = ["Social Media", "Loneliness", "Stress", "Boredom"];
    await db.dopamineUrges.clear();
    await db.dopamineUrges.bulkAdd([
      { timestamp: Date.now() - 1000 * 60 * 60 * 30, strength: 'high', triggers: [triggers[0], triggers[1]], notes: 'Browsing feeds late at night.' },
      { timestamp: Date.now() - 1000 * 60 * 60 * 24 * 7, strength: 'medium', triggers: [triggers[2]], notes: 'Tired after work.' },
      { timestamp: Date.now() - 1000 * 60 * 60 * 24 * 12, strength: 'low', triggers: [triggers[3]], notes: 'Had some free time in afternoon.' }
    ]);

    for (let i = -7; i <= 0; i++) {
      const targetDate = getLocalDateString(i);

      // Seed sleep logs
      const sleepDuration = i === 0 ? 7.5 : (7.0 + Math.random() * 1.5);
      const sleepQuality = i === 0 ? 82 : Math.round(70 + Math.random() * 25);
      await db.sleep.put({
        date: targetDate,
        totalHours: Number(sleepDuration.toFixed(1)),
        deepHours: Number((sleepDuration * 0.28).toFixed(1)),
        lightHours: Number((sleepDuration * 0.56).toFixed(1)),
        remHours: Number((sleepDuration * 0.16).toFixed(1)),
        awakeHours: Number((0.2 + Math.random() * 0.3).toFixed(1)),
        qualityScore: sleepQuality
      });

      // Seed water logs
      await db.water.put({
        date: targetDate,
        amountLiters: i === 0 ? 2.4 : Number((2.0 + Math.random() * 1.2).toFixed(1))
      });

      // Seed prayers
      // Give a few missed prayers in the history to make charts realistic
      const isToday = i === 0;
      await db.prayers.put({
        date: targetDate,
        fajr: isToday ? true : Math.random() > 0.1,
        dhuhr: isToday ? true : Math.random() > 0.15,
        asr: isToday ? true : Math.random() > 0.08,
        maghrib: isToday ? true : Math.random() > 0.12,
        isha: isToday ? true : Math.random() > 0.2,
        quranMinutes: isToday ? 15 : Math.round(10 + Math.random() * 20)
      });

      // Seed routine checkable timeline tasks
      const initialRoutines = [
        { taskName: "Fajr", timeLabel: "5:05 AM", completed: true, order: 1 },
        { taskName: "Qur'an", timeLabel: "15 min", completed: true, order: 2 },
        { taskName: "Workout", timeLabel: "30 min", completed: true, order: 3 },
        { taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: true, order: 4 },
        { taskName: "Dhuhr", timeLabel: "1:15 PM", completed: true, order: 5 },
        { taskName: "Lunch", timeLabel: "1:45 PM", completed: true, order: 6 },
        { taskName: "Asr", timeLabel: "5:00 PM", completed: true, order: 7 },
        { taskName: "Walk", timeLabel: "6:00 PM", completed: true, order: 8 },
        { taskName: "Maghrib", timeLabel: "7:24 PM", completed: true, order: 9 },
        { taskName: "Isha", timeLabel: "8:41 PM", completed: true, order: 10 },
        { taskName: "Read Book", timeLabel: "Pending", completed: false, order: 11 },
        { taskName: "Sleep", timeLabel: "10:30 PM", completed: false, order: 12 }
      ];

      for (const r of initialRoutines) {
        // If it's a historical day, randomize completion
        const comp = i === 0 ? r.completed : (r.order <= 10 ? Math.random() > 0.1 : Math.random() > 0.5);
        await db.routines.add({
          date: targetDate,
          taskName: r.taskName,
          timeLabel: r.timeLabel,
          completed: comp,
          order: r.order
        });
      }

      // Seed meals
      const mealLogs: MealLog[] = [
        { date: targetDate, mealType: 'breakfast', description: "4 Eggs, 2 Roti, Banana, Milk", calories: 650, proteinGrams: 35 },
        { date: targetDate, mealType: 'lunch', description: "Chicken, Rice, Daal, Salad", calories: 720, proteinGrams: 42 },
        { date: targetDate, mealType: 'snack', description: "Banana Shake, Roasted Chana", calories: 350, proteinGrams: 15 },
        { date: targetDate, mealType: 'dinner', description: "Roti, Daal, Vegetables, Yogurt", calories: 600, proteinGrams: 18 }
      ];
      for (const m of mealLogs) {
        await db.meals.add(m);
      }
    }

    set({ isInitialized: true });
  }
}));
