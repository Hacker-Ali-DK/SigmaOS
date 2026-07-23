'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, Flame, Shield, Check, X, BookOpen, Dumbbell, Footprints, Droplet, GraduationCap, Utensils, Moon, RefreshCw, Target, ChevronRight } from 'lucide-react';
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
  const routines = useLiveQuery(() => 
    db.routines.where({ date: selectedDate }).sortBy('order')
  );

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

  // Recalculate recovery scores whenever routines or date change
  useEffect(() => {
    async function updateScores() {
      const res = await getDailyScoresForDate(selectedDate);
      setScores(res);
      const sc = await calculateSelfControlForDate(selectedDate);
      setSelfControlDetail(sc);
    }
    updateScores();
  }, [routines, selectedDate, getDailyScoresForDate]);

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
          bedtime: `${selectedDate}T23:00`,
          waketime: `${selectedDate}T06:30`,
          qualityRating: 4.0,
          qualityScore: 80,
          source: 'manual'
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

  const overallAlignment = scores?.overallAlignment ?? 60;

  // Custom stroke dash values
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallAlignment / 100) * circumference;

  const subScores = [
    {
      key: 'wellness' as const,
      title: 'Wellness',
      data: scores?.wellness,
      colorClass: 'text-[#4CC9F0]',
      progressColor: 'bg-[#4CC9F0]',
    },
    {
      key: 'discipline' as const,
      title: 'Discipline',
      data: scores?.discipline,
      colorClass: 'text-[#FFB703]',
      progressColor: 'bg-[#FFB703]',
    },
    {
      key: 'deen' as const,
      title: 'Deen',
      data: scores?.deen,
      colorClass: 'text-[#02C39A]',
      progressColor: 'bg-[#02C39A]',
    }
  ];

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

      {/* Prayer Timeline Widget */}
      {timelineData && (
        <div className="glass-panel rounded-3xl p-5 bg-gradient-to-br from-[#0B0F19]/90 to-[#10172A]/90 border border-slate-900/60 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white font-heading">Prayer Timeline</h2>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {timelineData.activeInfo.activePrayer ? (
                <span className="text-[10px] bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  Active: {timelineData.activeInfo.activePrayer}
                </span>
              ) : (
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                  Between Windows
                </span>
              )}
              <span className="text-[10px] bg-blue-950/40 border border-blue-800/40 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                Next: {timelineData.activeInfo.nextPrayer} in {timelineData.activeInfo.countdownStr}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-1">
            {timelineData.items.map((item) => {
              let stateBadge = null;
              if (item.derivedState === 'prayed_on_time') {
                stateBadge = <span className="text-[8px] text-emerald-400 font-extrabold">On Time</span>;
              } else if (item.derivedState === 'prayed_late') {
                stateBadge = <span className="text-[8px] text-amber-400 font-extrabold">Late</span>;
              } else if (item.derivedState === 'missed') {
                stateBadge = <span className="text-[8px] text-rose-400 font-extrabold">Missed</span>;
              } else if (item.derivedState === 'pending') {
                stateBadge = <span className="text-[8px] text-cyan-400 font-extrabold animate-pulse">Window Open</span>;
              } else if (item.derivedState === 'window_expired') {
                stateBadge = <span className="text-[8px] text-slate-500 font-bold">Expired</span>;
              } else {
                stateBadge = <span className="text-[8px] text-slate-600 font-medium">Upcoming</span>;
              }

              return (
                <div 
                  key={item.key} 
                  className={cn(
                    "flex flex-col items-center p-2.5 rounded-2xl border transition-all text-center relative",
                    item.isCurrentWindow 
                      ? "bg-cyan-950/30 border-cyan-500/40 shadow-sm ring-1 ring-cyan-500/20" 
                      : item.derivedState === 'prayed_on_time'
                        ? "bg-emerald-950/20 border-emerald-900/30"
                        : item.derivedState === 'prayed_late'
                          ? "bg-amber-950/20 border-amber-900/30"
                          : item.derivedState === 'window_expired'
                            ? "bg-slate-950/40 border-slate-900/60 opacity-80"
                            : "bg-slate-950/30 border-slate-900/40"
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

      {/* Overall Alignment Circular Card */}
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
                {overallAlignment}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">/100</span>
            </div>
          </div>
          <span className="text-xs text-slate-400 mt-2 font-semibold">Overall Alignment</span>
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
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recovery Streak</span>
              <span className="text-sm font-extrabold text-slate-200">{profile?.cleanStreak ?? 0} days</span>
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
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Today's Self-Control</span>
              <span className="text-sm font-extrabold text-slate-200">
                {selfControlDetail.score === 'untracked' ? 'Not Tracked' : `${selfControlDetail.score}%`}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Wellness, Discipline, Deen Sub-scores */}
      <div className="flex flex-col gap-3">
        {subScores.map((sub) => {
          const isExpanded = expandedScore === sub.key;
          const scoreVal = sub.data?.score ?? 60;
          const status = sub.data?.status ?? 'untracked';
          
          return (
            <div 
              key={sub.key}
              onClick={() => setExpandedScore(isExpanded ? null : sub.key)}
              className={cn(
                "glass-panel rounded-2xl p-4 border transition-all duration-300 cursor-pointer",
                isExpanded ? "border-slate-800 bg-slate-900/10" : "hover:border-slate-800/80 bg-[#0B0F19]/60 border-slate-900/60"
              )}
            >
              {/* Card Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{sub.title}</h3>
                    <span className={cn(
                      "text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide",
                      status === 'completed' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                      status === 'partial' && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                      (status === 'untracked' || status === 'insufficient') && "bg-slate-800 text-slate-500 border border-slate-700"
                    )}>
                      {status === 'insufficient' ? 'insufficient data' : status}
                    </span>
                  </div>
                  {sub.data && sub.data.trackedCount !== undefined && status !== 'untracked' && status !== 'insufficient' && (
                    <span className="text-[9px] text-slate-500 font-bold mt-1">
                      Based on {sub.data.trackedCount} of {sub.data.totalCount} tracked areas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm font-extrabold font-heading", sub.colorClass)}>{scoreVal}</span>
                  <span className="text-[10px] text-slate-500 font-bold">/100</span>
                  <ChevronRight className={cn("w-3.5 h-3.5 text-slate-650 transition-transform duration-300", isExpanded && "transform rotate-90")} />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden mt-3">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", sub.progressColor)}
                  style={{ width: `${status === 'insufficient' || status === 'untracked' ? 0 : scoreVal}%` }}
                />
              </div>

              {/* Short explanation preview when collapsed */}
              {!isExpanded && sub.data?.recommendation && (
                <p className="text-[10px] text-slate-500 font-medium mt-2.5 truncate">
                  {sub.data.recommendation}
                </p>
              )}

              {/* Expanded details */}
              {isExpanded && (
                <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-slate-900/60 animate-in fade-in duration-200">
                  {/* Positives */}
                  {sub.data?.positives && sub.data.positives.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Positives</span>
                      {sub.data.positives.map((pos, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
                          <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                          <span>{pos}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Negatives */}
                  {sub.data?.negatives && sub.data.negatives.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-heading">Needs Attention</span>
                      {sub.data.negatives.map((neg, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-350 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>{neg}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recommendation Callout */}
                  {sub.data?.recommendation && (
                    <div className="mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-900 text-[11px] leading-relaxed text-slate-400">
                      <span className="font-bold text-slate-300 block mb-0.5 font-heading">Recommendation:</span>
                      {sub.data.recommendation}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
