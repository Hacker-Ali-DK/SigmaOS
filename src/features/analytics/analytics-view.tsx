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

  const avgWellness = chartData.length > 0 
    ? Math.round(chartData.reduce((sum, d) => sum + d.Wellness, 0) / chartData.length) 
    : 60;

  const avgDiscipline = chartData.length > 0 
    ? Math.round(chartData.reduce((sum, d) => sum + d.Discipline, 0) / chartData.length) 
    : 60;

  const avgDeen = chartData.length > 0 
    ? Math.round(chartData.reduce((sum, d) => sum + d.Deen, 0) / chartData.length) 
    : 60;

  const avgAlignment = chartData.length > 0 
    ? Math.round(chartData.reduce((sum, d) => sum + d.Alignment, 0) / chartData.length) 
    : 60;

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
      textColor: 'text-[#3A86FF]',
      bgColor: 'bg-blue-950/20 border-blue-900/30'
    },
    {
      title: 'Wellness Avg',
      value: `${avgWellness}/100`,
      trend: getTrend('Wellness'),
      icon: Award,
      textColor: 'text-[#4CC9F0]',
      bgColor: 'bg-cyan-950/20 border-cyan-900/30'
    },
    {
      title: 'Discipline Avg',
      value: `${avgDiscipline}/100`,
      trend: getTrend('Discipline'),
      icon: Sparkles,
      textColor: 'text-[#FFB703]',
      bgColor: 'bg-amber-950/20 border-amber-900/30'
    },
    {
      title: 'Deen Avg',
      value: `${avgDeen}/100`,
      trend: getTrend('Deen'),
      icon: BookOpen,
      textColor: 'text-[#02C39A]',
      bgColor: 'bg-emerald-950/20 border-emerald-900/30'
    }
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-200 font-heading tracking-wide">
          Progress
        </h1>
        <div className="flex gap-1.5 items-center">
          <Calendar className="w-3.5 h-3.5 text-[#3A86FF]" />
          <span className="text-xs text-slate-400 font-semibold">Date Range:</span>
        </div>
      </div>

      {/* Date Range Button Selector */}
      <div className="flex bg-slate-950 border border-slate-900/60 p-1 rounded-2xl w-full">
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
              "flex-1 py-1.5 text-center text-xs font-semibold capitalize rounded-xl transition-all cursor-pointer",
              dateRange === range.key 
                ? "bg-[#0B0F19] text-[#3A86FF] shadow-sm border border-slate-900/40" 
                : "text-slate-500 hover:text-slate-350"
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950 border border-slate-900/60 p-1 rounded-2xl w-full mt-1">
        {(['overview', 'habits', 'health', 'deen'] as const).map((tab) => (
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
                  className={cn("glass-panel rounded-2xl p-4 flex flex-col justify-between border min-h-[96px]", m.bgColor)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{m.title}</span>
                    <span className={cn(
                      "text-[10px] font-extrabold flex items-center gap-0.5",
                      isNeutral ? "text-slate-500" : m.trend.isUp ? "text-[#02C39A]" : "text-rose-500"
                    )}>
                      {!isNeutral && <TrendIcon className="w-2.5 h-2.5" />}
                      {m.trend.text}
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-lg font-extrabold text-slate-100 font-heading">{m.value}</span>
                    <Icon className={cn("w-4 h-4 opacity-80", m.textColor)} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recharts Chart Card */}
          <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Score Comparison Trends</h3>
            </div>
            
            {/* Chart Frame */}
            <div className="w-full h-56 mt-2 text-xs">
              {mounted && !loading ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A2035" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" tickLine={false} />
                    <YAxis stroke="#64748B" domain={[10, 100]} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937', borderRadius: '12px', color: '#F8FAFC' }}
                    />
                    <Line type="monotone" dataKey="Alignment" stroke="#3A86FF" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Wellness" stroke="#4CC9F0" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Discipline" stroke="#FFB703" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Deen" stroke="#02C39A" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 font-semibold animate-pulse">
                  Loading trend data...
                </div>
              )}
            </div>

            {/* Legend indicators */}
            <div className="flex items-center justify-center gap-4 flex-wrap mt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3A86FF]" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Alignment</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4CC9F0]" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Wellness</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FFB703]" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Discipline</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#02C39A]" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Deen</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'habits' && (
        <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
          <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Habit Consistency (7 Days)</h3>
            
            <div className="flex flex-col gap-4">
              {[
                { name: 'Water Target (3L)', value: '5/7 days', percent: 71, color: 'from-[#4CC9F0] to-[#3A86FF]' },
                { name: 'Workout (30m)', value: '3/7 days', percent: 43, color: 'from-orange-500 to-amber-500' },
                { name: 'Study (2.5 hrs)', value: '6/7 days', percent: 85, color: 'from-indigo-500 to-[#3A86FF]' },
                { name: 'Walk Target (8k steps)', value: '4/7 days', percent: 57, color: 'from-amber-400 to-orange-500' }
              ].map((hab, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">{hab.name}</span>
                    <span className="text-[10px] text-slate-500 font-bold">{hab.value} ({hab.percent}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden">
                    <div className={cn("h-full bg-gradient-to-r rounded-full", hab.color)} style={{ width: `${hab.percent}%` }} />
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
              <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-6 rounded-3xl text-center text-slate-500 text-xs font-semibold py-12">
                <Moon className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-40 animate-pulse" />
                No sleep records found for the selected date range.
                <p className="text-[10px] text-slate-650 mt-1">Please log your sleep in the Sleep Tracker page to view live analytics.</p>
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
            {/* Live Sleep consistency summary grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel rounded-2xl p-4 bg-indigo-950/10 border-indigo-900/20 flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Average Sleep Duration</span>
                <span className="text-base font-extrabold text-slate-200 mt-2 font-heading">
                  {stats.averageDuration} hrs
                </span>
                <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Target: {sleepTarget} hrs</span>
              </div>
              
              <div className="glass-panel rounded-2xl p-4 bg-purple-950/10 border-purple-900/20 flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Schedule Consistency</span>
                <span className="text-base font-extrabold text-[#3A86FF] mt-2 font-heading">
                  {stats.consistencyScore}%
                </span>
                <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Bedtime var: {stats.bedtimeVariation}</span>
              </div>

              <div className="glass-panel rounded-2xl p-4 bg-cyan-950/10 border-cyan-900/20 flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Avg Bedtime / Wake</span>
                <span className="text-xs font-extrabold text-slate-200 mt-2">
                  {stats.averageBedtime} / {stats.averageWakeup}
                </span>
                <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Wake var: {stats.waketimeVariation}</span>
              </div>

              <div className="glass-panel rounded-2xl p-4 bg-emerald-950/10 border-emerald-900/20 flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Night Sleep vs Naps</span>
                <span className="text-xs font-extrabold text-[#02C39A] mt-2">
                  {stats.averageDuration}h / {avgNapHours}h
                </span>
                <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Avg nap: {avgNapMins.toFixed(0)} min</span>
              </div>
            </div>

            {/* Sleep Score Trend Chart */}
            <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Sleep Score Trend</h3>
              <div className="w-full h-48 mt-1 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleepTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A2035" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748B" tickLine={false} />
                    <YAxis stroke="#64748B" domain={[0, 100]} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937', borderRadius: '12px', color: '#F8FAFC' }}
                    />
                    <Line type="monotone" dataKey="Sleep Score" stroke="#818CF8" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Duration" stroke="#34D399" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#818CF8]" />
                  <span>Sleep Score</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                  <span>Duration (hrs)</span>
                </div>
              </div>
            </div>

            {/* Objective Health Insight Banner */}
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-slate-200">Sleep Schedule Insight</span>
                <span className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
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
            <div className="glass-panel rounded-2xl p-4 bg-emerald-950/20 border-emerald-900/30 flex flex-col justify-between">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tracking Coverage</span>
              <span className="text-xl font-extrabold text-emerald-400 mt-2 font-heading">
                {deenAnalytics.coveragePercent}%
              </span>
              <span className="text-[9px] text-slate-500 font-medium mt-1">
                {deenAnalytics.trackedPrayers}/{deenAnalytics.applicablePrayers} prayers
              </span>
            </div>

            <div className="glass-panel rounded-2xl p-4 bg-cyan-950/20 border-cyan-900/30 flex flex-col justify-between">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">On-Time Rate</span>
              <span className="text-xl font-extrabold text-cyan-400 mt-2 font-heading">
                {deenAnalytics.onTimeRate}%
              </span>
              <span className="text-[9px] text-slate-500 font-medium mt-1">
                {deenAnalytics.onTimeCount} prayed on time
              </span>
            </div>

            <div className="glass-panel rounded-2xl p-4 bg-amber-950/20 border-amber-900/30 flex flex-col justify-between">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Late Rate</span>
              <span className="text-xl font-extrabold text-amber-400 mt-2 font-heading">
                {deenAnalytics.lateRate}%
              </span>
              <span className="text-[9px] text-slate-500 font-medium mt-1">
                {deenAnalytics.lateCount} prayed late
              </span>
            </div>

            <div className="glass-panel rounded-2xl p-4 bg-rose-950/20 border-rose-900/30 flex flex-col justify-between">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Missed Rate</span>
              <span className="text-xl font-extrabold text-rose-400 mt-2 font-heading">
                {deenAnalytics.missedRate}%
              </span>
              <span className="text-[9px] text-slate-500 font-medium mt-1">
                {deenAnalytics.missedCount} logged missed
              </span>
            </div>
          </div>

          {/* Deen Consistency Score History Chart */}
          <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Deen Consistency Score History</h3>
            <div className="w-full h-44 text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deenAnalytics.scoreHistory} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A2035" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="#64748B" tickLine={false} />
                  <YAxis stroke="#64748B" domain={[0, 100]} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937', borderRadius: '12px', color: '#F8FAFC' }}
                  />
                  <Line type="monotone" dataKey="score" name="Deen Score" stroke="#02C39A" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-Prayer Breakdown */}
          <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Live Per-Prayer Breakdown</h3>
            
            <div className="flex flex-col gap-4">
              {deenAnalytics.perPrayerStats.map((pr) => (
                <div key={pr.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">{pr.name}</span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {pr.onTimeCount}/{pr.trackedCount > 0 ? pr.trackedCount : pr.applicableCount} on time ({pr.onTimePercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950/60 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-emerald-400 transition-all" 
                      style={{ width: `${pr.trackedCount > 0 ? Math.round((pr.onTimeCount / pr.applicableCount) * 100) : 0}%` }} 
                      title={`${pr.onTimeCount} on time`}
                    />
                    <div 
                      className="h-full bg-amber-400 transition-all" 
                      style={{ width: `${pr.trackedCount > 0 ? Math.round((pr.lateCount / pr.applicableCount) * 100) : 0}%` }} 
                      title={`${pr.lateCount} late`}
                    />
                    <div 
                      className="h-full bg-rose-400 transition-all" 
                      style={{ width: `${pr.trackedCount > 0 ? Math.round((pr.missedCount / pr.applicableCount) * 100) : 0}%` }} 
                      title={`${pr.missedCount} missed`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Qur'an Recitation Trends Chart */}
          <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Qur'an Recitation Trends</h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                <span>Avg: <strong className="text-cyan-400">{deenAnalytics.avgQuranMinutes}</strong> min/day</span>
                <span>Active: <strong className="text-emerald-400">{deenAnalytics.quranActiveDays}</strong>/{deenAnalytics.daysLimit} days</span>
              </div>
            </div>

            <div className="w-full h-40 text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deenAnalytics.quranTrend} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A2035" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="#64748B" tickLine={false} />
                  <YAxis stroke="#64748B" tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937', borderRadius: '12px', color: '#F8FAFC' }}
                  />
                  <Bar dataKey="minutes" name="Recitation (mins)" fill="#4CC9F0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
