'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Edit2, Droplet, Dumbbell, Shield, BookOpen, GraduationCap, Footprints, Plus, Minus } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore, getLocalDateString } from '@/lib/store';
import { cn } from '@/lib/utils';

interface HabitsViewProps {
  onBack: () => void;
  onNavigateToDopamine: () => void;
}

export default function HabitsView({ onBack, onNavigateToDopamine }: HabitsViewProps) {
  const { selectedDate } = useAppStore();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Live queries
  const waterLog = useLiveQuery(() => db.water.get(selectedDate));
  const sleepLog = useLiveQuery(() => db.sleep.get(selectedDate));
  const prayerLog = useLiveQuery(() => db.prayers.get(selectedDate));
  const workoutLogs = useLiveQuery(() => db.workouts.where({ date: selectedDate }).toArray());
  const routineLogs = useLiveQuery(() => db.routines.where({ date: selectedDate }).toArray());

  // Derive habit quantities
  const waterAmt = waterLog?.amountLiters || 0;
  const quranMins = prayerLog?.quranMinutes || 0;
  const workoutMins = workoutLogs?.reduce((sum, w) => sum + w.durationMinutes, 0) || 0;
  
  // Custom study log aggregator from routines (e.g. "Study Session 1" has 2.5 Hrs)
  const studyHours = routineLogs
    ?.filter(r => r.completed && r.taskName.toLowerCase().includes('study'))
    .reduce((sum, r) => {
      const match = r.timeLabel.match(/(\d+(\.\d+)?)\s*Hrs/i);
      return sum + (match ? parseFloat(match[1]) : 3.2); // default mock 3.2 if completed
    }, 0) || 0;
  
  const walkSteps = routineLogs?.some(r => r.taskName === 'Walk' && r.completed) ? 8210 : 0;

  const handleUpdateWater = async (increment: number) => {
    const nextAmt = Math.max(0, Number((waterAmt + increment).toFixed(2)));
    await db.water.put({ date: selectedDate, amountLiters: nextAmt });
    
    // Sync routines
    const waterRoutine = routineLogs?.find(r => r.taskName === 'Water');
    if (waterRoutine?.id) {
      await db.routines.update(waterRoutine.id, { completed: nextAmt >= 3.0 });
    }
  };

  const handleUpdateQuran = async (increment: number) => {
    const nextMins = Math.max(0, quranMins + increment);
    const log = await db.prayers.get(selectedDate);
    await db.prayers.put({
      ...(log || {
        date: selectedDate,
        fajr: { status: 'not_tracked' },
        dhuhr: { status: 'not_tracked' },
        asr: { status: 'not_tracked' },
        maghrib: { status: 'not_tracked' },
        isha: { status: 'not_tracked' },
        quranMinutes: 0
      }),
      quranMinutes: nextMins
    });

    const quranRoutine = routineLogs?.find(r => r.taskName === "Qur'an");
    if (quranRoutine?.id) {
      await db.routines.update(quranRoutine.id, { completed: nextMins >= 15 });
    }
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
    } else {
      await db.workouts.where({ date: selectedDate }).delete();
    }

    const workoutRoutine = routineLogs?.find(r => r.taskName === 'Workout');
    if (workoutRoutine?.id) {
      await db.routines.update(workoutRoutine.id, { completed: nextMins >= 30 });
    }
  };

  const habitsList = [
    {
      id: 'water',
      title: 'Drink Water',
      current: waterAmt,
      target: 3.0,
      unit: 'Liters',
      color: 'bg-cyan-500',
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-950/20 border-cyan-900/30',
      icon: Droplet,
      onIncrement: () => handleUpdateWater(0.25),
      onDecrement: () => handleUpdateWater(-0.25),
    },
    {
      id: 'workout',
      title: 'Workout',
      current: workoutMins,
      target: 30,
      unit: 'min',
      color: 'bg-[#3A86FF]',
      textColor: 'text-[#3A86FF]',
      bgColor: 'bg-blue-950/20 border-blue-900/30',
      icon: Dumbbell,
      onIncrement: () => handleUpdateWorkout(10),
      onDecrement: () => handleUpdateWorkout(-10),
    },
    {
      id: 'dopamine',
      title: 'No Porn',
      current: 45,
      target: 90,
      unit: 'Days',
      color: 'bg-orange-500',
      textColor: 'text-orange-400',
      bgColor: 'bg-orange-950/20 border-orange-900/30',
      icon: Shield,
      isLink: true,
      onClick: onNavigateToDopamine,
    },
    {
      id: 'quran',
      title: "Read Qur'an",
      current: quranMins,
      target: 30,
      unit: 'min',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-950/20 border-emerald-900/30',
      icon: BookOpen,
      onIncrement: () => handleUpdateQuran(5),
      onDecrement: () => handleUpdateQuran(-5),
    },
    {
      id: 'study',
      title: 'Study',
      current: studyHours || 3.2, // fallback to mock if routines empty
      target: 4.0,
      unit: 'hrs',
      color: 'bg-purple-500',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-950/20 border-purple-900/30',
      icon: GraduationCap,
    },
    {
      id: 'walk',
      title: 'Walk',
      current: walkSteps || 8210, // fallback to mock if routines empty
      target: 10000,
      unit: 'steps',
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-950/20 border-amber-900/30',
      icon: Footprints,
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-slate-200 font-heading tracking-wide">
            Habits
          </h1>
        </div>
        <button className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold">
          <Edit2 className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950 border border-slate-900/60 p-1 rounded-2xl w-full">
        {(['daily', 'weekly', 'monthly'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 text-center text-xs font-semibold capitalize rounded-xl transition-all cursor-pointer",
              activeTab === tab 
                ? "bg-[#0B0F19] text-[#3A86FF] shadow-sm border border-slate-900/40" 
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Habits List Grid */}
      <div className="flex flex-col gap-4 mt-2">
        {habitsList.map((habit) => {
          const percent = Math.min(100, Math.round((habit.current / habit.target) * 100));
          const Icon = habit.icon;

          return (
            <div
              key={habit.id}
              onClick={habit.onClick}
              className={cn(
                "glass-panel rounded-2xl p-4 flex flex-col gap-3 transition-colors border",
                habit.isLink && "cursor-pointer hover:border-slate-800",
                habit.bgColor
              )}
            >
              {/* Top info row */}
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
                <span className={cn("text-xs font-extrabold", habit.textColor)}>
                  {percent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", habit.color)}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Control Buttons (if not link/goals) */}
              {!habit.isLink && (habit.onIncrement || habit.onDecrement) && (
                <div className="flex items-center justify-end gap-2 mt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); habit.onDecrement?.(); }}
                    className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-900 text-slate-400 hover:text-white hover:border-slate-800 transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); habit.onIncrement?.(); }}
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
    </div>
  );
}
