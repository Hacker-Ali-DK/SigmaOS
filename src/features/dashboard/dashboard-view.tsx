'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, Flame, Shield, Check, X, BookOpen, Dumbbell, Footprints, Droplet, GraduationCap, Utensils, Moon, RefreshCw, Target, ChevronRight } from 'lucide-react';
import { db, type RoutineTask } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface DashboardViewProps {
  onNavigateToSchedule: () => void;
  onNavigateToHabits: () => void;
  onNavigateToDopamine: () => void;
  onNavigateToSleep: () => void;
  onNavigateToNutrition: () => void;
  onNavigateToGoals: () => void;
}

export default function DashboardView({ 
  onNavigateToSchedule, 
  onNavigateToHabits, 
  onNavigateToDopamine,
  onNavigateToSleep,
  onNavigateToNutrition,
  onNavigateToGoals
}: DashboardViewProps) {
  const { selectedDate, calculateRecoveryScoreForDate } = useAppStore();
  const [recoveryScore, setRecoveryScore] = useState<number>(87);
  const [showRelapseBanner, setShowRelapseBanner] = useState(true);

  // Live queries
  const profile = useLiveQuery(() => db.userProfile.get(1));
  const routines = useLiveQuery(() => 
    db.routines.where({ date: selectedDate }).sortBy('order')
  );

  // Recalculate recovery score whenever routines or date change
  useEffect(() => {
    async function updateScore() {
      const score = await calculateRecoveryScoreForDate(selectedDate);
      setRecoveryScore(score);
    }
    updateScore();
  }, [routines, selectedDate, calculateRecoveryScoreForDate]);

  // Toggle routine completion status
  const handleToggleRoutine = async (task: RoutineTask) => {
    if (!task.id) return;
    const nextCompleted = !task.completed;
    
    // 1. Update routine log
    await db.routines.update(task.id, { completed: nextCompleted });

    // 2. Sync to other tables if applicable
    if (task.taskName === 'Fajr' || task.taskName === 'Dhuhr' || task.taskName === 'Asr' || task.taskName === 'Maghrib' || task.taskName === 'Isha') {
      const prayerField = task.taskName.toLowerCase() as 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
      const prayerLog = await db.prayers.get(selectedDate);
      if (prayerLog) {
        await db.prayers.update(selectedDate, { [prayerField]: nextCompleted });
      } else {
        await db.prayers.put({
          date: selectedDate,
          fajr: false,
          dhuhr: false,
          asr: false,
          maghrib: false,
          isha: false,
          quranMinutes: 0,
          [prayerField]: nextCompleted
        });
      }
    } else if (task.taskName === "Qur'an") {
      const log = await db.prayers.get(selectedDate);
      await db.prayers.put({
        ...(log || { date: selectedDate, fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false, quranMinutes: 0 }),
        quranMinutes: nextCompleted ? 15 : 0
      });
    } else if (task.taskName === 'Water') {
      await db.water.put({
        date: selectedDate,
        amountLiters: nextCompleted ? 2.4 : 0
      });
    } else if (task.taskName === 'Workout') {
      if (nextCompleted) {
        await db.workouts.add({ date: selectedDate, type: 'Workout', durationMinutes: 30, intensity: 'medium' });
      } else {
        await db.workouts.where({ date: selectedDate }).delete();
      }
    } else if (task.taskName === 'Sleep') {
      if (nextCompleted) {
        await db.sleep.put({
          date: selectedDate,
          totalHours: 7.5,
          deepHours: 2.1,
          lightHours: 4.2,
          remHours: 1.2,
          awakeHours: 0.3,
          qualityScore: 82
        });
      } else {
        await db.sleep.where({ date: selectedDate }).delete();
      }
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Fajr':
      case 'Dhuhr':
      case 'Asr':
      case 'Maghrib':
      case 'Isha':
        return <BookOpen className="w-4 h-4 text-emerald-400" />;
      case "Qur'an":
      case 'Read Book':
        return <BookOpen className="w-4 h-4 text-blue-400" />;
      case 'Workout':
        return <Dumbbell className="w-4 h-4 text-[#3A86FF]" />;
      case 'Walk':
        return <Footprints className="w-4 h-4 text-amber-400" />;
      case 'Water':
        return <Droplet className="w-4 h-4 text-cyan-400" />;
      case 'Study Session 1':
      case 'Study':
        return <GraduationCap className="w-4 h-4 text-indigo-400" />;
      case 'Lunch':
      case 'Meals':
        return <Utensils className="w-4 h-4 text-amber-500" />;
      case 'Sleep':
        return <Moon className="w-4 h-4 text-purple-400" />;
      default:
        return <Check className="w-4 h-4 text-slate-400" />;
    }
  };

  const completedCount = routines ? routines.filter(r => r.completed).length : 0;
  const totalCount = routines ? routines.length : 0;

  // Custom stroke dash values
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (recoveryScore / 100) * circumference;

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-24">
      {/* Header Profile Info */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-medium">As-salamu Alaykum,</span>
          <h1 className="text-xl font-extrabold text-white tracking-wide font-heading">
            {profile?.name || 'Abdullah'} 👋
          </h1>
        </div>
        <div className="relative p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center cursor-pointer hover:bg-slate-900/70 transition-colors">
          <Bell className="w-5 h-5 text-slate-400" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#3A86FF]"></span>
        </div>
      </div>

      {/* Recovery Score Circular Card */}
      <div className="glass-panel rounded-3xl p-6 flex items-center justify-between bg-gradient-to-br from-[#0B0F19]/90 to-[#111625]/90 border border-slate-900/60 relative overflow-hidden">
        {/* Left Side: Circular Ring */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r={radius}
                className="stroke-slate-900"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r={radius}
                className="stroke-[#3A86FF] transition-all duration-1000 ease-out"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-extrabold text-white tracking-tighter font-heading">
                {recoveryScore}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">/100</span>
            </div>
          </div>
          <span className="text-xs text-slate-400 mt-2 font-semibold">Recovery Score</span>
          <span className="text-[10px] text-[#02C39A] font-bold mt-0.5">Keep going, champion!</span>
        </div>

        {/* Right Side: Streaks info */}
        <div className="flex flex-col gap-4 flex-1 pl-4 border-l border-slate-800/40">
          <button 
            onClick={onNavigateToHabits}
            className="flex items-center gap-3 text-left cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-orange-400">
              <Flame className="w-5 h-5 fill-orange-500/10" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Streak</span>
              <span className="text-sm font-extrabold text-slate-200">23 days</span>
            </div>
          </button>

          <button 
            onClick={onNavigateToDopamine}
            className="flex items-center gap-3 text-left cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-[#02C39A]">
              <Shield className="w-5 h-5 fill-emerald-500/10" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Clean Days</span>
              <span className="text-sm font-extrabold text-slate-200">{profile?.cleanStreak ?? 0} days</span>
            </div>
          </button>
        </div>
      </div>

      {/* Today's Progress Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 
            onClick={onNavigateToSchedule}
            className="text-sm font-extrabold text-slate-200 font-heading hover:text-[#3A86FF] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            Today's Progress
            <span className="text-[10px] text-slate-500 font-bold">(click to schedule)</span>
          </h2>
          <span className="text-xs text-slate-400 font-bold bg-[#111625] px-2 py-0.5 rounded-full border border-slate-900/60">
            {completedCount}/{totalCount} Completed
          </span>
        </div>

        {/* Routine Grid */}
        <div className="grid grid-cols-3 gap-3">
          {routines?.map((task) => {
            const isCompleted = task.completed;
            
            return (
              <div
                key={task.id}
                onClick={() => {
                  if (task.taskName === 'Sleep') onNavigateToSleep();
                  else if (task.taskName === 'Meals' || task.taskName === 'Lunch' || task.taskName === 'Breakfast' || task.taskName === 'Dinner') onNavigateToNutrition();
                  else if (task.taskName === 'Water') onNavigateToHabits();
                  else if (task.taskName === 'Workout') onNavigateToHabits();
                  else handleToggleRoutine(task);
                }}
                className={cn(
                  "relative flex flex-col justify-between p-3 rounded-2xl border text-left transition-all duration-300 active:scale-[0.98] group cursor-pointer overflow-hidden min-h-[96px]",
                  isCompleted
                    ? "bg-[#0B0F19]/45 border-[#3A86FF]/20"
                    : "bg-[#0B0F19]/80 border-slate-900/70 hover:border-slate-850"
                )}
              >
                {/* Complete Overlay Glow */}
                {isCompleted && (
                  <div className="absolute inset-0 bg-[#3A86FF]/[0.02] pointer-events-none" />
                )}

                {/* Top Row: Task Name & Icon */}
                <div className="flex items-start justify-between w-full">
                  <span className="text-xs text-slate-300 font-bold tracking-tight line-clamp-1">
                    {task.taskName}
                  </span>
                  <div className="opacity-80 group-hover:scale-105 transition-transform">
                    {getIcon(task.taskName)}
                  </div>
                </div>

                {/* Bottom Row: Detail Value & Check Indicator */}
                <div className="flex items-end justify-between w-full mt-2">
                  <span className="text-[10px] text-slate-500 font-bold truncate pr-1">
                    {task.timeLabel}
                  </span>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // prevent card body redirect
                      handleToggleRoutine(task);
                    }}
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-300 cursor-pointer",
                      isCompleted 
                        ? "bg-[#02C39A] border-[#02C39A] text-slate-950 scale-105" 
                        : "border-slate-800 bg-slate-950/20"
                    )}
                  >
                    {isCompleted && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Goals Card Preview */}
      <div 
        onClick={onNavigateToGoals}
        className="glass-panel rounded-2xl p-4 flex items-center justify-between bg-gradient-to-br from-[#0B0F19] to-slate-950 border border-slate-900/60 hover:border-slate-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#3A86FF]">
            <Target className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold text-slate-100">Today's Goals</span>
            <span className="text-[9px] text-slate-500 font-bold">4 active targets • Gain Weight, Learn Flutter...</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </div>

      {/* Relapse/Shield Check Banner */}
      {showRelapseBanner && (
        <div className="glass-panel-glow rounded-2xl p-4 flex items-center justify-between bg-gradient-to-r from-emerald-950/20 via-[#0B0F19] to-slate-950 border border-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#02C39A]/10 flex items-center justify-center text-[#02C39A]">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-slate-100">No Relapse Today</span>
              <span className="text-[10px] text-slate-500 font-bold">Alhamdulillah! Clean day saved.</span>
            </div>
          </div>
          <button 
            onClick={() => setShowRelapseBanner(false)}
            className="p-1 rounded-full bg-slate-900/50 text-slate-500 hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
