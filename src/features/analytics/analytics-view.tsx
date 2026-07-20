'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TrendingUp, Activity, Moon, BookOpen, Footprints, Calendar } from 'lucide-react';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsView() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'habits' | 'health' | 'deen'>('overview');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch past 7 days of logs to populate averages and chart
  const sleepLogs = useLiveQuery(() => db.sleep.toArray());
  const waterLogs = useLiveQuery(() => db.water.toArray());
  const prayerLogs = useLiveQuery(() => db.prayers.toArray());

  // Static chart data mapping Mon-Sun
  const chartData = [
    { name: 'Mon', Energy: 65, Focus: 72, Mood: 80 },
    { name: 'Tue', Energy: 70, Focus: 68, Mood: 75 },
    { name: 'Wed', Energy: 85, Focus: 80, Mood: 82 },
    { name: 'Thu', Energy: 60, Focus: 70, Mood: 78 },
    { name: 'Fri', Energy: 88, Focus: 90, Mood: 87 },
    { name: 'Sat', Energy: 75, Focus: 85, Mood: 90 },
    { name: 'Sun', Energy: 82, Focus: 88, Mood: 85 },
  ];

  // Derive metrics (averages)
  const avgSleep = sleepLogs 
    ? Number((sleepLogs.reduce((sum, s) => sum + s.totalHours, 0) / sleepLogs.length).toFixed(1)) 
    : 7.2;

  const avgSteps = 8642; // static dashboard value
  const studyHours = 18.5; // static dashboard value
  const recoveryScore = 87; // static dashboard value

  const metrics = [
    {
      title: 'Recovery Score',
      value: `${recoveryScore}/100`,
      trend: '+12%',
      icon: Activity,
      textColor: 'text-[#3A86FF]',
      bgColor: 'bg-blue-950/20 border-blue-900/30'
    },
    {
      title: 'Sleep Avg',
      value: `${avgSleep} hrs`,
      trend: '+8%',
      icon: Moon,
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-950/20 border-purple-900/30'
    },
    {
      title: 'Study Time',
      value: `${studyHours} hrs`,
      trend: '+15%',
      icon: BookOpen,
      textColor: 'text-indigo-400',
      bgColor: 'bg-indigo-950/20 border-indigo-900/30'
    },
    {
      title: 'Steps Avg',
      value: avgSteps.toLocaleString(),
      trend: '+10%',
      icon: Footprints,
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-950/20 border-amber-900/30'
    }
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-200 font-heading tracking-wide">
          Progress
        </h1>
        <button className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5 text-[#3A86FF]" />
          This Week
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950 border border-slate-900/60 p-1 rounded-2xl w-full">
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
              return (
                <div 
                  key={idx} 
                  className={cn("glass-panel rounded-2xl p-4 flex flex-col justify-between border min-h-[96px]", m.bgColor)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{m.title}</span>
                    <span className="text-[10px] text-[#02C39A] font-extrabold flex items-center gap-0.5">
                      <TrendingUp className="w-2.5 h-2.5" />
                      {m.trend}
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
              <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Weekly Overview</h3>
            </div>
            
            {/* Chart Frame */}
            <div className="w-full h-56 mt-2 text-xs">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A2035" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" tickLine={false} />
                    <YAxis stroke="#64748B" domain={[40, 100]} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937', borderRadius: '12px', color: '#F8FAFC' }}
                    />
                    <Line type="monotone" dataKey="Energy" stroke="#FFB703" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Focus" stroke="#3A86FF" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Mood" stroke="#C77DFF" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 font-semibold animate-pulse">
                  Loading Overview...
                </div>
              )}
            </div>

            {/* Legend indicators */}
            <div className="flex items-center justify-center gap-6 mt-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFB703]" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Energy</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3A86FF]" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Focus</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C77DFF]" />
                <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Mood</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'overview' && (
        <div className="text-center py-12 text-xs text-slate-600 font-semibold border border-dashed border-slate-900/60 rounded-2xl mt-4">
          Detailed logs for <span className="capitalize">{activeTab}</span> analytics are loading...
        </div>
      )}
    </div>
  );
}
