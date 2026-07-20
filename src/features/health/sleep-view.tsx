'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Calendar, Moon, Sparkles, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface SleepViewProps {
  onBack: () => void;
}

export default function SleepView({ onBack }: SleepViewProps) {
  const { selectedDate } = useAppStore();

  // Query sleep log
  const sleepLog = useLiveQuery(() => 
    db.sleep.get(selectedDate)
  );

  // Form State
  const [showLogForm, setShowLogForm] = useState(false);
  const [sleepHours, setSleepHours] = useState('7.5');
  const [sleepQuality, setSleepQuality] = useState('82');

  const totalSleep = sleepLog?.totalHours || 7.5;
  const quality = sleepLog?.qualityScore || 82;
  const deepHours = sleepLog?.deepHours || 2.1;
  const lightHours = sleepLog?.lightHours || 4.2;
  const remHours = sleepLog?.remHours || 1.2;
  const awakeHours = sleepLog?.awakeHours || 0.3;

  const handleSaveSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(sleepHours) || 7.5;
    const qual = parseInt(sleepQuality) || 82;

    await db.sleep.put({
      date: selectedDate,
      totalHours: hrs,
      deepHours: Number((hrs * 0.28).toFixed(1)),
      lightHours: Number((hrs * 0.56).toFixed(1)),
      remHours: Number((hrs * 0.16).toFixed(1)),
      awakeHours: Number((0.2 + Math.random() * 0.2).toFixed(1)),
      qualityScore: qual
    });

    // Update routine check
    const routines = await db.routines.where({ date: selectedDate }).toArray();
    const sleepRoutine = routines.find(r => r.taskName === 'Sleep');
    if (sleepRoutine?.id) {
      await db.routines.update(sleepRoutine.id, { completed: true });
    }

    setShowLogForm(false);
  };

  // Percent calculation
  const totalPhases = deepHours + lightHours + remHours + awakeHours;
  const deepPercent = Math.round((deepHours / totalPhases) * 100) || 28;
  const lightPercent = Math.round((lightHours / totalPhases) * 100) || 56;
  const remPercent = Math.round((remHours / totalPhases) * 100) || 16;
  const awakePercent = Math.round((awakeHours / totalPhases) * 100) || 4;

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
            Sleep Tracker
          </h1>
        </div>
        <button 
          onClick={() => setShowLogForm(prev => !prev)}
          className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 text-[#3A86FF]" />
          Log Sleep
        </button>
      </div>

      {/* Large Sleep indicator widget */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/20 via-[#0B0F19] to-slate-950 border border-indigo-500/10 shadow-lg text-center relative overflow-hidden py-8">
        <div className="relative w-28 h-28 flex items-center justify-center mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="45"
              className="stroke-slate-900"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="56"
              cy="56"
              r="45"
              className="stroke-indigo-500 transition-all duration-1000 ease-out"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - quality / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-extrabold text-white font-heading tracking-tight">
              {totalSleep} hrs
            </span>
            <span className="text-[9px] text-[#4CC9F0] font-bold uppercase tracking-wider">Quality: {quality}%</span>
          </div>
        </div>
        
        <h3 className="text-sm font-extrabold text-slate-200 font-heading">Good Sleep Quality</h3>
        <p className="text-[10px] text-slate-500 font-semibold mt-1">Based on sleep depth and consistency</p>
      </div>

      {/* Logging form */}
      {showLogForm && (
        <form onSubmit={handleSaveSleep} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-slate-800/50 bg-[#0B0F19]/80 animate-in slide-in-from-top duration-300">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Sleep Duration (Hours)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="24"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-bold">
              <span>Sleep Quality</span>
              <span className="text-[#4CC9F0]">{sleepQuality}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={sleepQuality}
              onChange={(e) => setSleepQuality(e.target.value)}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-[#4CC9F0]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Save Sleep Log
          </button>
        </form>
      )}

      {/* Sleep Phases breakdown card */}
      <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
        <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Sleep Phases</h3>

        {/* Stacked bar */}
        <div className="w-full h-4 bg-slate-950/60 rounded-xl overflow-hidden flex">
          <div className="h-full bg-indigo-500" style={{ width: `${deepPercent}%` }} title={`Deep Sleep: ${deepHours}h`} />
          <div className="h-full bg-cyan-400" style={{ width: `${lightPercent}%` }} title={`Light Sleep: ${lightHours}h`} />
          <div className="h-full bg-purple-400" style={{ width: `${remPercent}%` }} title={`REM Sleep: ${remHours}h`} />
          <div className="h-full bg-rose-400" style={{ width: `${awakePercent}%` }} title={`Awake: ${awakeHours}h`} />
        </div>

        {/* Phase details grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Deep</span>
              <span className="text-xs font-extrabold text-slate-200">{deepHours} hrs</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Light</span>
              <span className="text-xs font-extrabold text-slate-200">{lightHours} hrs</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">REM</span>
              <span className="text-xs font-extrabold text-slate-200">{remHours} hrs</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Awake</span>
              <span className="text-xs font-extrabold text-slate-200">{awakeHours} hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      <div className="glass-panel rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-r from-slate-900/60 to-slate-950 border border-slate-800/40">
        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <Moon className="w-4.5 h-4.5 fill-indigo-500/10" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-xs font-extrabold text-slate-200">Sleep Goal: 8 hrs</span>
          <span className="text-[9px] text-slate-500 font-bold">You are 0.5 hrs away from your goal. Try sleeping earlier.</span>
        </div>
      </div>
    </div>
  );
}
