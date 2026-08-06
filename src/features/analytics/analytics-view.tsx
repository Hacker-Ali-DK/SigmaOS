'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TrendingUp, TrendingDown, Activity, Moon, BookOpen, Footprints, Calendar, Sparkles, Award, Coffee, Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  calculateHistoricalScoresForRange, 
  type HistoricalScoreEntry,
  calculateSleepConsistencyStats,
  calculateDailySleepScore
} from '@/lib/scoring/scoring-service';
import { calculateDeenAnalyticsForRange, type DeenAnalyticsResult } from '@/lib/deen/deen-analytics';
import { getLocalDateString } from '@/lib/store';

export default function AnalyticsView() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'habits' | 'health' | 'deen'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('7d');
  const [chartData, setChartData] = useState<HistoricalScoreEntry[]>([]);
  const [deenAnalytics, setDeenAnalytics] = useState<DeenAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Live queries
  const daysLimit = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  const sleepLogs = useLiveQuery(() => db.sleep.orderBy('date').reverse().limit(daysLimit).toArray(), [dateRange]);
  const napLogs = useLiveQuery(() => db.naps.orderBy('date').reverse().limit(daysLimit).toArray(), [dateRange]);
  const prayerLogs = useLiveQuery(() => db.prayers.orderBy('date').reverse().limit(daysLimit).toArray(), [dateRange]);
  const profile = useLiveQuery(() => db.userProfile.get(1));

  // Dynamic Habits Analytics computation over daysLimit range
  const habitStats = useLiveQuery(async () => {
    const dates: string[] = [];
    const end = new Date(getLocalDateString());
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    const startDateStr = dates[0];
    const endDateStr = dates[dates.length - 1];

    const [waterLogs, workoutLogs, routineLogs, journalLogs, pLogs] = await Promise.all([
      db.water.where('date').between(startDateStr, endDateStr, true, true).toArray(),
      db.workouts.where('date').between(startDateStr, endDateStr, true, true).toArray(),
      db.routines.where('date').between(startDateStr, endDateStr, true, true).toArray(),
      db.journal.where('date').between(startDateStr, endDateStr, true, true).toArray(),
      db.prayers.where('date').between(startDateStr, endDateStr, true, true).toArray()
    ]);

    const waterMap = new Map(waterLogs.map(w => [w.date, w]));
    const journalMap = new Map(journalLogs.map(j => [j.date, j]));
    const prayerMap = new Map(pLogs.map(p => [p.date, p]));

    const workoutsGrouped = new Map<string, any[]>();
    workoutLogs.forEach(w => {
      const arr = workoutsGrouped.get(w.date) || [];
      arr.push(w);
      workoutsGrouped.set(w.date, arr);
    });

    const routinesGrouped = new Map<string, any[]>();
    routineLogs.forEach(r => {
      const arr = routinesGrouped.get(r.date) || [];
      arr.push(r);
      routinesGrouped.set(r.date, arr);
    });

    const targetWater = profile?.dailyWaterTarget || 3.0;
    const targetScreen = profile?.dailyScreenTimeTarget || 4.0;

    let waterDays = 0;
    let workoutDays = 0;
    let studyDays = 0;
    let readingDays = 0;
    let screenDays = 0;

    for (const dStr of dates) {
      // 1. Water
      const wLog = waterMap.get(dStr);
      if (wLog && wLog.amountLiters >= targetWater) {
        waterDays++;
      }

      // 2. Workout
      const wList = workoutsGrouped.get(dStr) || [];
      const dRts = routinesGrouped.get(dStr) || [];
      const workoutMins = wList.reduce((s, w) => s + w.durationMinutes, 0);
      const workoutRt = dRts.find(r => r.taskName.toLowerCase().includes('workout') || r.taskName.toLowerCase().includes('exercise'));
      if (workoutMins >= 30 || workoutRt?.completed) {
        workoutDays++;
      }

      // 3. Study / Learning
      const studyRt = dRts.find(r => 
        r.taskName.toLowerCase().includes('study') || 
        r.taskName.toLowerCase().includes('programming') || 
        r.taskName.toLowerCase().includes('learn')
      );
      if (studyRt?.completed) {
        studyDays++;
      }

      // 4. Reading / Qur'an
      const readRt = dRts.find(r => 
        r.taskName.toLowerCase().includes('read') || 
        r.taskName.toLowerCase().includes('book') || 
        r.taskName.toLowerCase().includes("qur'an") || 
        r.taskName.toLowerCase().includes("quran")
      );
      const pLog = prayerMap.get(dStr);
      if (readRt?.completed || (pLog && pLog.quranMinutes && pLog.quranMinutes >= 15)) {
        readingDays++;
      }

      // 5. Screen Time Limit
      const jLog = journalMap.get(dStr);
      if (jLog && jLog.screenHours !== undefined && jLog.screenHours <= targetScreen) {
        screenDays++;
      }
    }

    const totalDays = daysLimit;
    return [
      { 
        name: `Water Target (${targetWater}L)`, 
        value: `${waterDays}/${totalDays} days`, 
        percent: Math.round((waterDays / totalDays) * 100), 
        color: 'from-[#4CC9F0] to-[#D7B88C]' 
      },
      { 
        name: 'Workout Target (30m)', 
        value: `${workoutDays}/${totalDays} days`, 
        percent: Math.round((workoutDays / totalDays) * 100), 
        color: 'from-orange-500 to-amber-500' 
      },
      { 
        name: 'Study / Learning Target', 
        value: `${studyDays}/${totalDays} days`, 
        percent: Math.round((studyDays / totalDays) * 100), 
        color: 'from-indigo-500 to-[#D7B88C]' 
      },
      { 
        name: 'Reading / Qur\'an Target', 
        value: `${readingDays}/${totalDays} days`, 
        percent: Math.round((readingDays / totalDays) * 100), 
        color: 'from-emerald-400 to-[#02C39A]' 
      },
      { 
        name: `Screen Time Limit (≤${targetScreen}h)`, 
        value: `${screenDays}/${totalDays} days`, 
        percent: Math.round((screenDays / totalDays) * 100), 
        color: 'from-amber-400 to-orange-500' 
      }
    ];
  }, [daysLimit, profile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadTrends() {
      setLoading(true);
      const data = await calculateHistoricalScoresForRange(getLocalDateString(), daysLimit);
      setChartData(data);
      const deenData = await calculateDeenAnalyticsForRange(getLocalDateString(), daysLimit);
      setDeenAnalytics(deenData);
      setLoading(false);
    }
    loadTrends();
  }, [dateRange, daysLimit, prayerLogs]);

  const activeAlignmentDays = chartData.filter(d => d.Alignment > 0);
  const activeWellnessDays = chartData.filter(d => d.Wellness > 0);
  const activeDisciplineDays = chartData.filter(d => d.Discipline > 0);
  const activeDeenDays = chartData.filter(d => d.Deen > 0);

  const avgAlignment = activeAlignmentDays.length > 0 
    ? Math.round(activeAlignmentDays.reduce((sum, d) => sum + d.Alignment, 0) / activeAlignmentDays.length) 
    : 0;

  const avgWellness = activeWellnessDays.length > 0 
    ? Math.round(activeWellnessDays.reduce((sum, d) => sum + d.Wellness, 0) / activeWellnessDays.length) 
    : 0;

  const avgDiscipline = activeDisciplineDays.length > 0 
    ? Math.round(activeDisciplineDays.reduce((sum, d) => sum + d.Discipline, 0) / activeDisciplineDays.length) 
    : 0;

  const avgDeen = activeDeenDays.length > 0 
    ? Math.round(activeDeenDays.reduce((sum, d) => sum + d.Deen, 0) / activeDeenDays.length) 
    : 0;

  const getTrend = (key: 'Wellness' | 'Discipline' | 'Deen' | 'Alignment') => {
    if (chartData.length < 2) return { text: '0%', isUp: true, textArrow: '→' };
    const mid = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, mid);
    const secondHalf = chartData.slice(mid);
    const avg1 = firstHalf.reduce((sum, d) => sum + d[key], 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((sum, d) => sum + d[key], 0) / secondHalf.length;
    const diff = Math.round(avg2 - avg1);
    
    if (diff > 0) return { text: `+${diff}%`, isUp: true, textArrow: '↑' };
    if (diff < 0) return { text: `${diff}%`, isUp: false, textArrow: '↓' };
    return { text: '0%', isUp: true, textArrow: '→' };
  };

  const metrics = [
    {
      title: 'Overall Alignment',
      value: `${avgAlignment}/100`,
      trend: getTrend('Alignment'),
      icon: Activity,
      textColor: 'text-white',
      bgColor: 'bg-[#1E2328] border-slate-800'
    },
    {
      title: 'Wellness Avg',
      value: `${avgWellness}/100`,
      trend: getTrend('Wellness'),
      icon: Award,
      textColor: 'text-[#2D5BFF]',
      bgColor: 'bg-blue-950/10 border-blue-900/20'
    },
    {
      title: 'Discipline Avg',
      value: `${avgDiscipline}/100`,
      trend: getTrend('Discipline'),
      icon: Sparkles,
      textColor: 'text-[#9A5E4D]',
      bgColor: 'bg-orange-950/10 border-orange-900/20'
    },
    {
      title: 'Deen Avg',
      value: `${avgDeen}/100`,
      trend: getTrend('Deen'),
      icon: BookOpen,
      textColor: 'text-[#D7B88C]',
      bgColor: 'bg-amber-950/10 border-amber-900/20'
    }
  ];

  return (
    <div className="flex flex-col px-4 pt-6 pb-24 min-h-screen bg-[#0A0A0A] animate-in fade-in duration-500 relative">
      {/* Header */}
      <div className="flex flex-col items-center mb-6 mt-2">
        <h1 className="text-xl font-bold text-white font-heading tracking-[0.2em] uppercase">
          Progress
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#1E2328] rounded-xl p-1 mb-4 shadow-lg shadow-black/20">
        {(['overview', 'habits', 'health', 'deen'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2.5 text-center text-[10px] font-bold capitalize rounded-lg transition-all cursor-pointer",
              activeTab === tab 
                ? "bg-[#0A0A0A] text-[#D7B88C] shadow-sm border border-slate-800" 
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2 mb-6">
        {([
          { key: '7d', label: '7 Days' },
          { key: '30d', label: '30 Days' },
          { key: '90d', label: '90 Days' },
          { key: '1y', label: '1 Year' }
        ] as const).map((range) => (
          <button
            key={range.key}
            onClick={() => setDateRange(range.key)}
            className={cn(
              "flex-1 py-2 text-center text-[10px] font-bold capitalize rounded-lg transition-all cursor-pointer border",
              dateRange === range.key 
                ? "bg-[#2D5BFF] text-white border-[#2D5BFF] shadow-lg shadow-[#2D5BFF]/20" 
                : "bg-[#1E2328] text-slate-400 border-slate-800/50 hover:text-slate-300 hover:border-slate-700"
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4 mt-2">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m, idx) => {
              const Icon = m.icon;
              const TrendIcon = m.trend.isUp ? TrendingUp : TrendingDown;
              const isNeutral = m.trend.text === '0%';
              return (
                <div 
                  key={idx} 
                  className={cn("rounded-3xl p-4 flex flex-col justify-between border bg-[#0A0A0A] shadow-md", m.bgColor.includes('border-') ? m.bgColor.split(' ').find(c => c.startsWith('border-')) : 'border-[#1E2328]')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{m.title}</span>
                    <span className={cn(
                      "text-[10px] font-extrabold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md",
                      isNeutral ? "text-slate-500 bg-slate-900" : m.trend.isUp ? "text-[#02C39A] bg-[#02C39A]/10" : "text-rose-500 bg-rose-500/10"
                    )}>
                      {!isNeutral && <TrendIcon className="w-2.5 h-2.5" />}
                      {m.trend.text}
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-2xl font-extrabold text-slate-100 font-heading tracking-tight">{m.value.split('/')[0]}<span className="text-[10px] text-slate-600 ml-0.5">/100</span></span>
                    <div className={cn("p-1.5 rounded-full", m.bgColor.includes('bg-') ? m.bgColor.split(' ').find(c => c.startsWith('bg-')) : 'bg-[#1E2328]')}>
                      <Icon className={cn("w-4 h-4", m.textColor)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recharts Chart Card */}
          <div className="bg-[#0A0A0A] border border-[#1E2328] p-5 rounded-3xl flex flex-col gap-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Score Comparison Trends</h3>
            </div>
            
            {/* Chart Frame */}
            <div className="w-full h-56 mt-2 text-xs">
              {mounted && !loading ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2328" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#64748B" domain={[0, 100]} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#1E2328', borderRadius: '16px', color: '#F8FAFC', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Line type="monotone" dataKey="Alignment" stroke="#FFFFFF" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#FFFFFF' }} />
                    <Line type="monotone" dataKey="Wellness" stroke="#2D5BFF" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#2D5BFF' }} />
                    <Line type="monotone" dataKey="Discipline" stroke="#9A5E4D" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#9A5E4D' }} />
                    <Line type="monotone" dataKey="Deen" stroke="#D7B88C" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#D7B88C' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 font-semibold animate-pulse text-xs">
                  Loading trend data...
                </div>
              )}
            </div>

            {/* Legend indicators */}
            <div className="flex items-center justify-center gap-3 flex-wrap mt-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1E2328]">
                <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Alignment</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1E2328]">
                <span className="w-2 h-2 rounded-full bg-[#2D5BFF] shadow-[0_0_5px_rgba(45,91,255,0.5)]" />
                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Wellness</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1E2328]">
                <span className="w-2 h-2 rounded-full bg-[#9A5E4D] shadow-[0_0_5px_rgba(154,94,77,0.5)]" />
                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Discipline</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1E2328]">
                <span className="w-2 h-2 rounded-full bg-[#D7B88C] shadow-[0_0_5px_rgba(215,184,140,0.5)]" />
                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Deen</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'habits' && (
        <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
          <div className="bg-[#0A0A0A] border border-[#1E2328] p-5 rounded-3xl flex flex-col gap-5 shadow-lg">
            <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Habit Consistency ({daysLimit === 365 ? '1 Year' : `${daysLimit} Days`})</h3>
            
            <div className="flex flex-col gap-5">
              {(habitStats || []).map((hab, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{hab.name}</span>
                    <span className="text-[10px] font-bold text-slate-400">{hab.value} <span className="text-white ml-1">({hab.percent}%)</span></span>
                  </div>
                  <div className="w-full h-2 bg-[#1E2328] rounded-full overflow-hidden">
                    <div className={cn("h-full bg-gradient-to-r rounded-full transition-all duration-500", hab.color)} style={{ width: `${hab.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'health' && (() => {
        const sleepTarget = profile?.dailySleepTarget || 8.0;
        const stats = calculateSleepConsistencyStats(sleepLogs || [], daysLimit);
        
        const validSleepLogs = sleepLogs || [];
        const validNapLogs = napLogs || [];
        const totalNapMins = validNapLogs.reduce((sum, n) => sum + n.durationMinutes, 0);
        const avgNapMins = validSleepLogs.length > 0 ? (totalNapMins / validSleepLogs.length) : 0;
        const avgNapHours = Number((avgNapMins / 60).toFixed(1));

        const sleepTrendData = validSleepLogs.slice().reverse().map(log => {
          const scoreDetail = calculateDailySleepScore(log, sleepTarget);
          return {
            date: log.date.substring(5),
            'Sleep Score': scoreDetail.score,
            'Duration': log.totalHours
          };
        });

        if (validSleepLogs.length === 0) {
          return (
            <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
              <div className="bg-[#0A0A0A] border border-[#1E2328] p-6 rounded-3xl text-center text-slate-500 text-xs font-semibold py-12 shadow-lg">
                <Moon className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-40 animate-pulse" />
                No sleep records found for the selected date range.
                <p className="text-[10px] text-slate-650 mt-2">Please log your sleep in the Sleep Tracker page to view live analytics.</p>
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
            {/* Live Sleep consistency summary grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Average Sleep Duration</span>
                <span className="text-xl font-extrabold text-slate-200 mt-2 font-heading tracking-tight">
                  {stats.averageDuration} <span className="text-[10px] text-slate-500 font-sans ml-0.5">hrs</span>
                </span>
                <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">Target: {sleepTarget} hrs</span>
              </div>
              
              <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Schedule Consistency</span>
                <span className="text-xl font-extrabold text-[#D7B88C] mt-2 font-heading tracking-tight">
                  {stats.consistencyScore}<span className="text-[10px] text-slate-500 font-sans ml-0.5">%</span>
                </span>
                <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">Bedtime var: {stats.bedtimeVariation}</span>
              </div>

              <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Avg Bedtime / Wake</span>
                <span className="text-xs font-extrabold text-slate-200 mt-2 font-mono">
                  {stats.averageBedtime} / {stats.averageWakeup}
                </span>
                <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">Wake var: {stats.waketimeVariation}</span>
              </div>

              <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Night Sleep vs Naps</span>
                <span className="text-xs font-extrabold text-[#02C39A] mt-2 font-mono">
                  {stats.averageDuration}h / {avgNapHours}h
                </span>
                <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">Avg nap: {avgNapMins.toFixed(0)} min</span>
              </div>
            </div>

            {/* Sleep Score Trend Chart */}
            <div className="bg-[#0A0A0A] border border-[#1E2328] p-5 rounded-3xl flex flex-col gap-4 shadow-lg">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Sleep Score Trend</h3>
              <div className="w-full h-48 mt-1 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleepTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2328" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748B" tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#64748B" domain={[0, 100]} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#1E2328', borderRadius: '16px', color: '#F8FAFC', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Line type="monotone" dataKey="Sleep Score" stroke="#818CF8" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#818CF8' }} />
                    <Line type="monotone" dataKey="Duration" stroke="#34D399" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: '#34D399' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1E2328]">
                  <span className="w-2 h-2 rounded-full bg-[#818CF8] shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
                  <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Sleep Score</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1E2328]">
                  <span className="w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
                  <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Duration (hrs)</span>
                </div>
              </div>
            </div>

            {/* Objective Health Insight Banner */}
            <div className="p-4 rounded-3xl bg-[#0A0A0A] border border-[#1E2328] shadow-md flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1E2328] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-slate-200">Sleep Schedule Insight</span>
                <span className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                  {stats.consistencyScore >= 80 
                    ? "Your sleep schedule has become more consistent. Continuing this routine supports circadian alignment."
                    : "Variable bedtime or wake-up times have been logged. Consistently aligning bedtime within a 30-minute window supports recovery."}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === 'deen' && deenAnalytics && (
        <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
          {/* Rate Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Tracking Coverage</span>
              <span className="text-xl font-extrabold text-[#02C39A] mt-2 font-heading tracking-tight">
                {deenAnalytics.coveragePercent}<span className="text-[10px] text-slate-500 font-sans ml-0.5">%</span>
              </span>
              <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">
                {deenAnalytics.trackedPrayers}/{deenAnalytics.applicablePrayers} prayers
              </span>
            </div>

            <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">On-Time Rate</span>
              <span className="text-xl font-extrabold text-cyan-400 mt-2 font-heading tracking-tight">
                {deenAnalytics.onTimeRate}<span className="text-[10px] text-slate-500 font-sans ml-0.5">%</span>
              </span>
              <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">
                {deenAnalytics.onTimeCount} on time
              </span>
            </div>

            <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Late Rate</span>
              <span className="text-xl font-extrabold text-[#D7B88C] mt-2 font-heading tracking-tight">
                {deenAnalytics.lateRate}<span className="text-[10px] text-slate-500 font-sans ml-0.5">%</span>
              </span>
              <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">
                {deenAnalytics.lateCount} late
              </span>
            </div>

            <div className="rounded-3xl p-4 bg-[#0A0A0A] border border-[#1E2328] shadow-md flex flex-col justify-between min-h-[90px]">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Missed Rate</span>
              <span className="text-xl font-extrabold text-rose-500 mt-2 font-heading tracking-tight">
                {deenAnalytics.missedRate}<span className="text-[10px] text-slate-500 font-sans ml-0.5">%</span>
              </span>
              <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">
                {deenAnalytics.missedCount} missed
              </span>
            </div>
          </div>

          {/* Deen Consistency Score History Chart */}
          <div className="bg-[#0A0A0A] border border-[#1E2328] p-5 rounded-3xl flex flex-col gap-4 shadow-lg">
            <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Deen Consistency Score History</h3>
            <div className="w-full h-44 text-xs mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deenAnalytics.scoreHistory} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2328" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="#64748B" tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748B" domain={[0, 100]} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#1E2328', borderRadius: '16px', color: '#F8FAFC', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="score" name="Deen Score" stroke="#02C39A" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#02C39A' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-Prayer Breakdown */}
          <div className="bg-[#0A0A0A] border border-[#1E2328] p-5 rounded-3xl flex flex-col gap-4 shadow-lg">
            <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Live Per-Prayer Breakdown</h3>
            
            <div className="flex flex-col gap-5 mt-2">
              {deenAnalytics.perPrayerStats.map((pr) => (
                <div key={pr.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{pr.name}</span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {pr.onTimeCount}/{pr.trackedCount > 0 ? pr.trackedCount : pr.applicableCount} on time <span className="text-white ml-1">({pr.onTimePercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#1E2328] rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-[#02C39A] transition-all" 
                      style={{ width: `${pr.trackedCount > 0 ? Math.round((pr.onTimeCount / pr.applicableCount) * 100) : 0}%` }} 
                      title={`${pr.onTimeCount} on time`}
                    />
                    <div 
                      className="h-full bg-[#D7B88C] transition-all" 
                      style={{ width: `${pr.trackedCount > 0 ? Math.round((pr.lateCount / pr.applicableCount) * 100) : 0}%` }} 
                      title={`${pr.lateCount} late`}
                    />
                    <div 
                      className="h-full bg-rose-500 transition-all" 
                      style={{ width: `${pr.trackedCount > 0 ? Math.round((pr.missedCount / pr.applicableCount) * 100) : 0}%` }} 
                      title={`${pr.missedCount} missed`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Qur'an Recitation Trends Chart */}
          <div className="bg-[#0A0A0A] border border-[#1E2328] p-5 rounded-3xl flex flex-col gap-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Qur'an Recitation Trends</h3>
              <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold uppercase">
                <span>Avg: <strong className="text-cyan-400 text-[10px]">{deenAnalytics.avgQuranMinutes}</strong> min</span>
                <span>Active: <strong className="text-[#02C39A] text-[10px]">{deenAnalytics.quranActiveDays}</strong>/{deenAnalytics.daysLimit} d</span>
              </div>
            </div>

            <div className="w-full h-40 text-xs mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deenAnalytics.quranTrend} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2328" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="#64748B" tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748B" tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#1E2328', borderRadius: '16px', color: '#F8FAFC', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    cursor={{fill: '#1E2328'}}
                  />
                  <Bar dataKey="minutes" name="Recitation (mins)" fill="#2D5BFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
