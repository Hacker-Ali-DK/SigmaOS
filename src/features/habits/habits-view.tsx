'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Droplet, Dumbbell, Shield, BookOpen, GraduationCap, Footprints, Plus, Minus } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface HabitsViewProps {
  onBack: () => void;
  onNavigateToDopamine: () => void;
}

function buildDateRange(daysBack: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

export default function HabitsView({ onBack, onNavigateToDopamine }: HabitsViewProps) {
  const { selectedDate } = useAppStore();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // ── Daily live queries ─────────────────────────────────────────────────────
  const profile = useLiveQuery(() => db.userProfile.get(1));
  const waterLog = useLiveQuery(() => db.water.get(selectedDate), [selectedDate]);
  const prayerLog = useLiveQuery(() => db.prayers.get(selectedDate), [selectedDate]);
  const workoutLogs = useLiveQuery(() => db.workouts.where({ date: selectedDate }).toArray(), [selectedDate]);
  const routineLogs = useLiveQuery(() => db.routines.where({ date: selectedDate }).toArray(), [selectedDate]);

  const waterAmt = waterLog?.amountLiters || 0;
  const quranMins = prayerLog?.quranMinutes || 0;
  const workoutMins = workoutLogs?.reduce((sum, w) => sum + w.durationMinutes, 0) || 0;
  const cleanStreak = profile?.cleanStreak ?? 0;
  const studyHours = routineLogs
    ?.filter(r => r.completed && r.taskName.toLowerCase().includes('study'))
    .reduce((sum, r) => {
      const label = (r && typeof r.timeLabel === 'string') ? r.timeLabel : '';
      const match = label.match(/(\d+(\.\d+)?)\s*Hrs/i);
      return sum + (match ? parseFloat(match[1]) : 2.5);
    }, 0) || 0;
  const walkSteps = routineLogs?.some(r => r.taskName === 'Walk' && r.completed) ? 10000 : 0;

  const quranRoutine = routineLogs?.find(r => r.taskName === "Qur'an");
  const quranTargetMins = quranRoutine?.timeLabel
    ? (quranRoutine.timeLabel.match(/(\d+)\s*min/i) ? parseInt(quranRoutine.timeLabel.match(/(\d+)\s*min/i)![1]) : 15)
    : 15;
  const studyRoutines = routineLogs?.filter(r => r.taskName.toLowerCase().includes('study')) || [];
  const studyTargetHours = studyRoutines.length > 0
    ? studyRoutines.reduce((sum, r) => {
        const label = r.timeLabel || '';
        const match = label.match(/(\d+(\.\d+)?)\s*Hrs/i);
        return sum + (match ? parseFloat(match[1]) : 2.5);
      }, 0)
    : 2.5;

  const handleUpdateWater = async (increment: number) => {
    const nextAmt = Math.max(0, Number((waterAmt + increment).toFixed(2)));
    await db.water.put({ date: selectedDate, amountLiters: nextAmt });
    const waterRoutine = routineLogs?.find(r => r.taskName === 'Water');
    if (waterRoutine?.id) await db.routines.update(waterRoutine.id, { completed: nextAmt >= 3.0 });
  };

  const handleUpdateQuran = async (increment: number) => {
    const nextMins = Math.max(0, quranMins + increment);
    const log = await db.prayers.get(selectedDate);
    await db.prayers.put({
      ...(log || {
        date: selectedDate,
        fajr: { status: 'not_tracked' }, dhuhr: { status: 'not_tracked' },
        asr: { status: 'not_tracked' }, maghrib: { status: 'not_tracked' },
        isha: { status: 'not_tracked' }, quranMinutes: 0
      }),
      quranMinutes: nextMins
    });
    const qr = routineLogs?.find(r => r.taskName === "Qur'an");
    if (qr?.id) await db.routines.update(qr.id, { completed: nextMins >= 15 });
  };

  const handleUpdateWorkout = async (increment: number) => {
    const nextMins = Math.max(0, workoutMins + increment);
    if (nextMins > 0) {
      const existing = await db.workouts.where({ date: selectedDate }).first();
      if (existing?.id) {
        await db.workouts.update(existing.id, { durationMinutes: nextMins });
      } else {
        await db.workouts.add({ date: selectedDate, type: 'Workout', durationMinutes: nextMins, intensity: 'medium' });
      }
    }
    const wr = routineLogs?.find(r => r.taskName === 'Workout');
    if (wr?.id) await db.routines.update(wr.id, { completed: nextMins >= 30 });
  };

  // ── Aggregated stats for Weekly / Monthly ─────────────────────────────────
  const daysForTab = activeTab === 'weekly' ? 7 : activeTab === 'monthly' ? 30 : 0;

  const aggregatedStats = useLiveQuery(async () => {
    if (activeTab === 'daily') return null;
    const dates = buildDateRange(daysForTab);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const [waterLogs, workoutArr, routineArr, prayerArr] = await Promise.all([
      db.water.where('date').between(startDate, endDate, true, true).toArray(),
      db.workouts.where('date').between(startDate, endDate, true, true).toArray(),
      db.routines.where('date').between(startDate, endDate, true, true).toArray(),
      db.prayers.where('date').between(startDate, endDate, true, true).toArray(),
    ]);

    const p = await db.userProfile.get(1);
    const waterTarget = p?.dailyWaterTarget || 3.0;
    const waterDays = waterLogs.filter(w => w.amountLiters >= waterTarget).length;
    const avgWater = dates.length > 0
      ? waterLogs.reduce((s, w) => s + w.amountLiters, 0) / dates.length
      : 0;

    const routinesGrouped = new Map<string, any[]>();
    routineArr.forEach(r => {
      const arr = routinesGrouped.get(r.date) || []; arr.push(r); routinesGrouped.set(r.date, arr);
    });
    const workoutsGrouped = new Map<string, any[]>();
    workoutArr.forEach(w => {
      const arr = workoutsGrouped.get(w.date) || []; arr.push(w); workoutsGrouped.set(w.date, arr);
    });
    const prayerMap = new Map(prayerArr.map(pp => [pp.date, pp]));

    let workoutDays = 0, studyDays = 0, walkDays = 0, quranDays = 0;
    let totalWorkoutMins = 0, totalQuranMins = 0;

    for (const dStr of dates) {
      const rts = routinesGrouped.get(dStr) || [];
      const wList = workoutsGrouped.get(dStr) || [];
      const pLog = prayerMap.get(dStr);

      const wMins = wList.reduce((s: number, w: any) => s + w.durationMinutes, 0);
      const workoutRt = rts.find((r: any) => r.taskName.toLowerCase().includes('workout'));
      if (wMins >= 30 || workoutRt?.completed) { workoutDays++; totalWorkoutMins += wMins || 30; }

      const studyRt = rts.find((r: any) => r.taskName.toLowerCase().includes('study') || r.taskName.toLowerCase().includes('learn'));
      if (studyRt?.completed) studyDays++;

      const walkRt = rts.find((r: any) => r.taskName === 'Walk');
      if (walkRt?.completed) walkDays++;

      const qMins = pLog?.quranMinutes || 0;
      const quranRt = rts.find((r: any) => r.taskName.toLowerCase().includes("qur"));
      if (qMins > 0 || quranRt?.completed) { quranDays++; totalQuranMins += qMins || 15; }
    }

    return {
      totalDays: daysForTab,
      waterDays, avgWater: Number(avgWater.toFixed(2)), waterTarget,
      workoutDays, avgWorkoutMins: workoutDays > 0 ? Math.round(totalWorkoutMins / workoutDays) : 0,
      studyDays, walkDays, quranDays,
      avgQuranMins: quranDays > 0 ? Math.round(totalQuranMins / quranDays) : 0,
      cleanStreak: p?.cleanStreak ?? 0,
    };
  }, [activeTab, daysForTab]);

  const dailyHabitsList = [
    {
      id: 'water', title: 'Drink Water', current: waterAmt,
      target: profile?.dailyWaterTarget || 3.0, unit: 'Liters',
      color: 'bg-[#2D5BFF]', textColor: 'text-[#2D5BFF]', bgColor: 'bg-[#1E2328] border-slate-800',
      icon: Droplet, onIncrement: () => handleUpdateWater(0.25), onDecrement: () => handleUpdateWater(-0.25),
    },
    {
      id: 'workout', title: 'Workout', current: workoutMins, target: 30, unit: 'min',
      color: 'bg-[#D7B88C]', textColor: 'text-[#D7B88C]', bgColor: 'bg-[#1E2328] border-slate-800',
      icon: Dumbbell, onIncrement: () => handleUpdateWorkout(10), onDecrement: () => handleUpdateWorkout(-10),
    },
    {
      id: 'dopamine', title: 'No Porn', current: cleanStreak, target: 90, unit: 'Days',
      color: 'bg-[#9A5E4D]', textColor: 'text-[#9A5E4D]', bgColor: 'bg-[#1E2328] border-slate-800',
      icon: Shield, isLink: true, onClick: onNavigateToDopamine,
    },
    {
      id: 'quran', title: "Read Qur'an", current: quranMins, target: quranTargetMins, unit: 'min',
      color: 'bg-[#22C55E]', textColor: 'text-[#22C55E]', bgColor: 'bg-[#1E2328] border-slate-800',
      icon: BookOpen, onIncrement: () => handleUpdateQuran(5), onDecrement: () => handleUpdateQuran(-5),
    },
    {
      id: 'study', title: 'Study', current: studyHours, target: studyTargetHours, unit: 'hrs',
      color: 'bg-[#2D5BFF]', textColor: 'text-[#2D5BFF]', bgColor: 'bg-[#1E2328] border-slate-800',
      icon: GraduationCap,
    },
    {
      id: 'walk', title: 'Walk', current: walkSteps, target: 10000, unit: 'steps',
      color: 'bg-[#D7B88C]', textColor: 'text-[#D7B88C]', bgColor: 'bg-[#1E2328] border-slate-800',
      icon: Footprints,
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold text-slate-200 font-heading tracking-wide">Habits</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#0A0A0A] border border-[#1E2328] p-1 rounded-2xl w-full">
        {(['daily', 'weekly', 'monthly'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 text-center text-xs font-semibold capitalize rounded-xl transition-all cursor-pointer",
              activeTab === tab
                ? "bg-[#1E2328] text-[#D7B88C] shadow-sm border border-slate-800"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── DAILY TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div className="flex flex-col gap-4 mt-2">
          {dailyHabitsList.map((habit) => {
            const percent = Math.min(100, Math.round((habit.current / habit.target) * 100));
            const Icon = habit.icon;
            return (
              <div
                key={habit.id}
                onClick={(habit as any).onClick}
                className={cn(
                  "glass-panel rounded-2xl p-4 flex flex-col gap-3 transition-colors border",
                  (habit as any).isLink && "cursor-pointer hover:border-slate-800",
                  habit.bgColor
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-white/5", habit.textColor)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-200">{habit.title}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {habit.current} / {habit.target} {habit.unit}
                      </span>
                    </div>
                  </div>
                  <span className={cn("text-xs font-extrabold", habit.textColor)}>{percent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", habit.color)}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {!(habit as any).isLink && ((habit as any).onIncrement || (habit as any).onDecrement) && (
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); (habit as any).onDecrement?.(); }}
                      className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-900 text-slate-400 hover:text-white hover:border-slate-800 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); (habit as any).onIncrement?.(); }}
                      className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-900 text-slate-400 hover:text-white hover:border-slate-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── WEEKLY / MONTHLY TAB ──────────────────────────────────────── */}
      {(activeTab === 'weekly' || activeTab === 'monthly') && (
        <div className="flex flex-col gap-4 mt-2">
          {!aggregatedStats ? (
            <div className="text-center py-10 text-xs text-slate-500 font-semibold">Computing stats…</div>
          ) : (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold text-center">
                Last {daysForTab} days — completion summary
              </p>
              {[
                {
                  id: 'water', title: 'Drink Water',
                  days: aggregatedStats.waterDays, total: aggregatedStats.totalDays,
                  detail: `Avg ${aggregatedStats.avgWater}L/day (target: ${aggregatedStats.waterTarget}L)`,
                  color: 'bg-cyan-500', textColor: 'text-cyan-400',
                  bgColor: 'bg-cyan-950/20 border-cyan-900/30', icon: Droplet,
                },
                {
                  id: 'workout', title: 'Workout',
                  days: aggregatedStats.workoutDays, total: aggregatedStats.totalDays,
                  detail: aggregatedStats.workoutDays > 0
                    ? `Avg ${aggregatedStats.avgWorkoutMins} min on active days`
                    : 'No logged workouts in this period',
                  color: 'bg-[#D7B88C]', textColor: 'text-[#D7B88C]',
                  bgColor: 'bg-blue-950/20 border-blue-900/30', icon: Dumbbell,
                },
                {
                  id: 'quran', title: "Read Qur'an",
                  days: aggregatedStats.quranDays, total: aggregatedStats.totalDays,
                  detail: aggregatedStats.quranDays > 0
                    ? `Avg ${aggregatedStats.avgQuranMins} min on active days`
                    : "No Qur'an sessions logged",
                  color: 'bg-emerald-500', textColor: 'text-emerald-400',
                  bgColor: 'bg-emerald-950/20 border-emerald-900/30', icon: BookOpen,
                },
                {
                  id: 'study', title: 'Study',
                  days: aggregatedStats.studyDays, total: aggregatedStats.totalDays,
                  detail: `${aggregatedStats.studyDays} days with study sessions completed`,
                  color: 'bg-purple-500', textColor: 'text-purple-400',
                  bgColor: 'bg-purple-950/20 border-purple-900/30', icon: GraduationCap,
                },
                {
                  id: 'walk', title: 'Walk',
                  days: aggregatedStats.walkDays, total: aggregatedStats.totalDays,
                  detail: `${aggregatedStats.walkDays} days with daily walk completed`,
                  color: 'bg-amber-500', textColor: 'text-amber-500',
                  bgColor: 'bg-amber-950/20 border-amber-900/30', icon: Footprints,
                },
                {
                  id: 'dopamine', title: 'No Porn (Streak)',
                  days: aggregatedStats.cleanStreak, total: 90,
                  detail: `Current clean streak: ${aggregatedStats.cleanStreak} days`,
                  color: 'bg-orange-500', textColor: 'text-orange-400',
                  bgColor: 'bg-orange-950/20 border-orange-900/30', icon: Shield,
                  isLink: true, onClick: onNavigateToDopamine,
                },
              ].map((stat) => {
                const pct = Math.min(100, Math.round((stat.days / stat.total) * 100));
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.id}
                    onClick={(stat as any).onClick}
                    className={cn(
                      "glass-panel rounded-2xl p-4 flex flex-col gap-3 border",
                      (stat as any).isLink && "cursor-pointer hover:border-slate-800",
                      stat.bgColor
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-white/5", stat.textColor)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-extrabold text-slate-200">{stat.title}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{stat.detail}</span>
                        </div>
                      </div>
                      <span className={cn("text-xs font-extrabold", stat.textColor)}>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", stat.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {stat.id === 'dopamine'
                        ? `${stat.days} / ${stat.total} days streak`
                        : `${stat.days} / ${stat.total} days`}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
