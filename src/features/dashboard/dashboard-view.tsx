'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, Flame, Shield, Check, X, BookOpen, Dumbbell, Footprints, Droplet, GraduationCap, Utensils, Moon, RefreshCw, Target, ChevronRight, Menu, TrendingUp } from 'lucide-react';
import { db, type RoutineTask, type DetailedPrayerStatus, type PrayerDetail } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { type DailyScores } from '@/lib/scoring/types';
import { calculateSelfControlForDate } from '@/lib/scoring/scoring-service';
import { calculatePrayerTimes } from '@/lib/deen/prayer-engine';
import { resolveCalculationOptions, computePrayerTimeline } from '@/lib/deen/prayer-timeline';

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
  const { selectedDate, getDailyScoresForDate } = useAppStore();
  const [scores, setScores] = useState<DailyScores | null>(null);
  const [selfControlDetail, setSelfControlDetail] = useState<{
    score: number | 'untracked';
    urgesToday: number;
    resistedToday: number;
    relapsesToday: number;
  }>({ score: 'untracked', urgesToday: 0, resistedToday: 0, relapsesToday: 0 });
  const [showRelapseBanner, setShowRelapseBanner] = useState(true);
  const [expandedScore, setExpandedScore] = useState<'wellness' | 'discipline' | 'deen' | null>(null);

  // Live queries
  const profile = useLiveQuery(() => db.userProfile.get(1));
  const prayerLog = useLiveQuery(() => db.prayers.get(selectedDate), [selectedDate]);
  const sleepLog = useLiveQuery(() => db.sleep.get(selectedDate), [selectedDate]);
  const waterLog = useLiveQuery(() => db.water.get(selectedDate), [selectedDate]);
  const mealLogs = useLiveQuery(() => db.meals.where({ date: selectedDate }).toArray(), [selectedDate]);
  const workoutLogs = useLiveQuery(() => db.workouts.where({ date: selectedDate }).toArray(), [selectedDate]);
  const journalLog = useLiveQuery(() => db.journal.get(selectedDate), [selectedDate]);
  const dopamineUrges = useLiveQuery(() => db.dopamineUrges.toArray());
  const routines = useLiveQuery(() => 
    db.routines.where({ date: selectedDate }).sortBy('order'),
    [selectedDate]
  );
  const activeGoals = useLiveQuery(() => db.goals.where({ completed: 0 as any }).toArray());

  const prayerTimes = React.useMemo(() => {
    try {
      const opts = resolveCalculationOptions(profile, prayerLog, selectedDate);
      return calculatePrayerTimes(opts);
    } catch (e) {
      return null;
    }
  }, [profile, prayerLog, selectedDate]);

  const timelineData = React.useMemo(() => {
    if (!prayerTimes) return null;
    return computePrayerTimeline(prayerTimes, prayerLog);
  }, [prayerTimes, prayerLog]);

  // Recalculate recovery scores whenever routines, health logs, prayers, or date change
  useEffect(() => {
    async function updateScores() {
      const res = await getDailyScoresForDate(selectedDate);
      setScores(res);
      const sc = await calculateSelfControlForDate(selectedDate);
      setSelfControlDetail(sc);
    }
    updateScores();
  }, [routines, sleepLog, waterLog, mealLogs, workoutLogs, journalLog, prayerLog, dopamineUrges, selectedDate, getDailyScoresForDate]);

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
      const now = new Date();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const newStatus: DetailedPrayerStatus = nextCompleted ? 'prayed_on_time' : 'not_tracked';

      if (prayerLog) {
        const existingDetail = (prayerLog[prayerField] && typeof prayerLog[prayerField] === 'object') ? (prayerLog[prayerField] as any) : {};
        const updatedDetail: PrayerDetail = {
          ...existingDetail,
          status: newStatus,
          completedTime: nextCompleted ? currentTimeStr : undefined
        };
        const updateObj: any = { [prayerField]: updatedDetail };
        await db.prayers.update(selectedDate, updateObj);
      } else {
        const updatedDetail: PrayerDetail = {
          status: newStatus,
          completedTime: nextCompleted ? currentTimeStr : undefined
        };
        const notTrackedDetail: PrayerDetail = { status: 'not_tracked' };
        await db.prayers.put({
          date: selectedDate,
          fajr: prayerField === 'fajr' ? updatedDetail : notTrackedDetail,
          dhuhr: prayerField === 'dhuhr' ? updatedDetail : notTrackedDetail,
          asr: prayerField === 'asr' ? updatedDetail : notTrackedDetail,
          maghrib: prayerField === 'maghrib' ? updatedDetail : notTrackedDetail,
          isha: prayerField === 'isha' ? updatedDetail : notTrackedDetail,
          quranMinutes: 0
        });
      }
    } else if (task.taskName === "Qur'an") {
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
        quranMinutes: nextCompleted ? 15 : 0
      });
    } else if (task.taskName === 'Water') {
      const currentLog = await db.water.get(selectedDate);
      if (nextCompleted && (!currentLog || currentLog.amountLiters < 2.4)) {
        await db.water.put({
          date: selectedDate,
          amountLiters: 2.4
        });
      }
    }
  };

  // Helper to cycle prayer status on tap (On Time -> Late -> Missed -> Untracked)
  const handleCyclePrayerStatus = async (field: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', currentStatus: DetailedPrayerStatus) => {
    let nextStatus: DetailedPrayerStatus = 'prayed_on_time';
    if (currentStatus === 'prayed_on_time') nextStatus = 'prayed_late';
    else if (currentStatus === 'prayed_late') nextStatus = 'missed';
    else if (currentStatus === 'missed') nextStatus = 'not_tracked';
    else nextStatus = 'prayed_on_time';

    const existingLog = await db.prayers.get(selectedDate);
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const existingDetail = (existingLog && existingLog[field] && typeof existingLog[field] === 'object') ? (existingLog[field] as any) : {};

    const updatedDetail: PrayerDetail = {
      ...existingDetail,
      status: nextStatus,
      completedTime: (nextStatus === 'prayed_on_time' || nextStatus === 'prayed_late') ? currentTimeStr : undefined
    };

    await db.prayers.put({
      ...(existingLog || {
        date: selectedDate,
        fajr: { status: 'not_tracked' },
        dhuhr: { status: 'not_tracked' },
        asr: { status: 'not_tracked' },
        maghrib: { status: 'not_tracked' },
        isha: { status: 'not_tracked' },
        quranMinutes: 0
      }),
      [field]: updatedDetail
    });

    const routineTask = routines?.find(r => r.taskName.toLowerCase() === field);
    if (routineTask?.id) {
      await db.routines.update(routineTask.id, {
        completed: nextStatus === 'prayed_on_time' || nextStatus === 'prayed_late'
      });
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
        return <Dumbbell className="w-4 h-4 text-[#D7B88C]" />;
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

  const overallAlignment = scores?.overallAlignment ?? 0;

  // Custom stroke dash values
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallAlignment / 100) * circumference;

  const subScores = [
    {
      key: 'wellness' as const,
      title: 'Wellness',
      data: scores?.wellness,
      colorClass: 'text-[#2D5BFF]',
      progressColor: 'bg-[#2D5BFF]',
    },
    {
      key: 'discipline' as const,
      title: 'Discipline',
      data: scores?.discipline,
      colorClass: 'text-[#9A5E4D]',
      progressColor: 'bg-[#9A5E4D]',
    },
    {
      key: 'deen' as const,
      title: 'Deen',
      data: scores?.deen,
      colorClass: 'text-[#D7B88C]',
      progressColor: 'bg-[#D7B88C]',
    }
  ];

  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-24 relative">
      {/* Header Profile Info */}
      <div className="flex items-center justify-between z-10 relative">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-medium font-sans">Good morning,</span>
          <h1 className="text-2xl font-extrabold text-[#D7B88C] tracking-widest font-heading mt-1 uppercase">
            {profile?.name || 'SIGMA'}
          </h1>
          <p className="text-[9px] text-slate-500 mt-1 max-w-[200px]">
            May Allah strengthen your strength and guide your path.
          </p>
        </div>
        <div className="relative p-2.5 rounded-full bg-[#1E2328] border border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors">
          <Bell className="w-5 h-5 text-slate-300" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D7B88C]"></span>
        </div>
      </div>

      {/* Prayer Timeline Widget */}
      {timelineData && (
        <div className="glass-panel rounded-3xl p-5 bg-[#0A0A0A] border border-[#1E2328] flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center text-[#22C55E]">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white font-heading">Prayer Timeline</h2>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {timelineData.activeInfo.activePrayer ? (
                <span className="text-[10px] bg-[#D7B88C]/10 border border-[#D7B88C]/20 text-[#D7B88C] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D7B88C] animate-pulse"></span>
                  Active: {timelineData.activeInfo.activePrayer}
                </span>
              ) : (
                <span className="text-[10px] bg-[#1E2328] border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                  Between Windows
                </span>
              )}
              <span className="text-[10px] bg-[#2D5BFF]/10 border border-[#2D5BFF]/20 text-[#2D5BFF] px-2 py-0.5 rounded-full font-bold">
                Next: {timelineData.activeInfo.nextPrayer} in {timelineData.activeInfo.countdownStr}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-1">
            {timelineData.items.map((item) => {
              let stateBadge = null;
              if (item.derivedState === 'prayed_on_time') {
                stateBadge = <span className="text-[8px] text-[#22C55E] font-extrabold">On Time</span>;
              } else if (item.derivedState === 'prayed_late') {
                stateBadge = <span className="text-[8px] text-amber-400 font-extrabold">Late</span>;
              } else if (item.derivedState === 'missed') {
                stateBadge = <span className="text-[8px] text-[#EF4444] font-extrabold">Missed</span>;
              } else if (item.derivedState === 'pending') {
                stateBadge = <span className="text-[8px] text-[#4CC9F0] font-extrabold animate-pulse">Window Open</span>;
              } else if (item.derivedState === 'window_expired') {
                stateBadge = <span className="text-[8px] text-slate-500 font-bold">Expired</span>;
              } else {
                stateBadge = <span className="text-[8px] text-slate-600 font-medium">Upcoming</span>;
              }

              return (
                <div 
                  key={item.key} 
                  onClick={() => handleCyclePrayerStatus(item.key, item.userStatus)}
                  title="Click to cycle status: On Time -> Late -> Missed -> Untracked"
                  className={cn(
                    "flex flex-col items-center p-2.5 rounded-2xl border transition-all text-center relative cursor-pointer hover:border-slate-700 active:scale-95",
                    item.isCurrentWindow 
                      ? "bg-[#4CC9F0]/10 border-[#4CC9F0]/30 shadow-sm ring-1 ring-[#4CC9F0]/20" 
                      : item.derivedState === 'prayed_on_time'
                        ? "bg-[#22C55E]/10 border-[#22C55E]/20"
                        : item.derivedState === 'prayed_late'
                          ? "bg-amber-950/20 border-amber-900/30"
                          : item.derivedState === 'window_expired'
                            ? "bg-[#1E2328]/60 border-slate-800 opacity-80"
                            : "bg-[#1E2328]/40 border-slate-800"
                  )}
                >
                  <span className="text-[10px] font-bold text-slate-300 capitalize font-heading">{item.label}</span>
                  <span className="text-xs font-black text-white mt-0.5 font-mono tracking-tight">{item.timeStr}</span>
                  
                  <div className="mt-1.5">
                    {stateBadge}
                  </div>

                  {item.completedTime && (
                    <span className="text-[7px] text-slate-400 font-mono mt-0.5">✓ {item.completedTime}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall Alignment */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Overall Alignment</h2>
        <div className="relative w-full rounded-3xl bg-[#0A0A0A] border border-[#1E2328] p-6 flex items-center justify-between shadow-xl overflow-hidden">
          {/* Decorative background blur */}
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#2D5BFF]/5 rounded-full blur-3xl"></div>
          
          <div className="flex flex-col z-10">
            <span className="text-6xl font-extrabold text-[#2D5BFF] font-heading tracking-tighter">
              {overallAlignment}
              <span className="text-lg text-slate-600 ml-1 font-sans">/100</span>
            </span>
          </div>
          
          <div className="relative w-24 h-24 flex items-center justify-center z-10">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="42" className="stroke-[#1E2328]" strokeWidth="4" fill="transparent" />
              <circle
                cx="48" cy="48" r="42"
                className="stroke-[#2D5BFF] transition-all duration-1000 ease-out"
                strokeWidth="4" fill="transparent"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={(2 * Math.PI * 42) - (overallAlignment / 100) * (2 * Math.PI * 42)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <span className="text-[7px] text-slate-400 font-medium leading-tight">
                You're building a strong foundation.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Scores Grid */}
      <div className="grid grid-cols-3 gap-3">
        {subScores.map((sub) => {
          const scoreVal = sub.data?.score ?? 0;
          const status = sub.data?.status ?? 'untracked';
          const isUntracked = status === 'untracked' || status === 'insufficient';
          
          let statusText = 'Untracked';
          if (!isUntracked) {
            if (scoreVal >= 90) statusText = 'Excellent';
            else if (scoreVal >= 70) statusText = 'Good';
            else if (scoreVal >= 50) statusText = 'Fair';
            else statusText = 'Needs Work';
          }

          return (
            <div key={sub.key} className="flex flex-col items-center justify-center bg-[#0A0A0A] border border-[#1E2328] rounded-2xl py-4 shadow-lg">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">{sub.title}</span>
              <div className="flex items-baseline">
                <span className={cn("text-2xl font-extrabold font-heading", sub.colorClass)}>
                  {isUntracked ? '--' : scoreVal}
                </span>
              </div>
              <span className={cn("text-[9px] mt-1 font-bold", isUntracked ? "text-slate-600" : sub.colorClass)}>
                {statusText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Today's Commitments Section */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
            Today's Commitments
          </h2>
          <span onClick={onNavigateToSchedule} className="text-[9px] text-[#D7B88C] font-bold cursor-pointer uppercase tracking-wider">
            View All
          </span>
        </div>

        {/* Horizontal Scroll List */}
        <div className="flex overflow-x-auto gap-3 pb-4 no-scrollbar px-2 -mx-2">
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
                className="flex flex-col items-center justify-between min-w-[72px] p-3 rounded-2xl bg-[#0A0A0A] border border-[#1E2328] cursor-pointer group shrink-0 shadow-md"
              >
                <div className="text-slate-400 group-hover:text-[#D7B88C] transition-colors mb-3">
                  {getIcon(task.taskName)}
                </div>
                <span className="text-[9px] text-slate-300 font-bold tracking-widest uppercase mb-3 text-center truncate w-full">
                  {task.taskName}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleRoutine(task); }}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 cursor-pointer",
                    isCompleted ? "bg-transparent border-[#D7B88C] text-[#D7B88C]" : "border-slate-700 bg-transparent"
                  )}
                >
                  {isCompleted && <div className="w-3 h-3 rounded-full bg-[#D7B88C]" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Goals Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
            Today's Goals
          </h2>
          <span onClick={onNavigateToGoals} className="text-[9px] text-[#D7B88C] font-bold cursor-pointer uppercase tracking-wider">
            View All
          </span>
        </div>

        {activeGoals && activeGoals.length > 0 ? (
          <div className="flex flex-col gap-3">
            {activeGoals.slice(0, 2).map(goal => {
              const progressPct = goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0;
              return (
                <div key={goal.id} className="relative rounded-3xl p-5 flex flex-col gap-4 bg-[#0A0A0A] border border-[#1E2328] shadow-lg overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D7B88C]/20"></div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-slate-700/50 flex items-center justify-center text-[#D7B88C] bg-[#1E2328]/50">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-200">{goal.title}</span>
                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">Day {goal.currentValue} of {goal.targetValue}</span>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-[#D7B88C] font-heading">{progressPct}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#1E2328] rounded-full overflow-hidden">
                    <div className="h-full bg-[#D7B88C] rounded-full" style={{ width: `${progressPct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div 
            onClick={onNavigateToGoals}
            className="rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer bg-[#0A0A0A] border border-[#1E2328] shadow-lg text-center"
          >
            <div className="w-12 h-12 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-500 mb-3">
              <Target className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-300">No Active Goals</span>
            <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Tap to add your first goal</span>
          </div>
        )}
      </div>

      {/* Relapse/Shield Check Banner */}
      {showRelapseBanner && (
        <div className="glass-panel-glow rounded-2xl p-4 flex items-center justify-between bg-[#1E2328] border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
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
