'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, User, Settings, Bell, Database, Info, Flame, Shield, Activity, ChevronRight, BookOpen, Weight, Save, Download, Upload } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function ProfileView() {
  const [profileView, setProfileView] = useState<'main' | 'journal' | 'weight' | 'settings'>('main');

  // Queries
  const profile = useLiveQuery(() => db.userProfile.get(1));
  
  // Settings Form State
  const [name, setName] = useState('');
  const [calTarget, setCalTarget] = useState('2500');
  const [waterTarget, setWaterTarget] = useState('3.0');
  const [sleepTarget, setSleepTarget] = useState('8.0');

  // Journal State
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState('good');
  const [journalLogs, setJournalLogs] = useState<{ date: string; text: string; mood: string }[]>([]);

  // Weight State
  const [weightInput, setWeightInput] = useState('69.0');
  const [weightLogs, setWeightLogs] = useState<{ date: string; weight: number }[]>([
    { date: '19 Jul', weight: 69.0 },
    { date: '18 Jul', weight: 68.8 },
    { date: '17 Jul', weight: 69.2 }
  ]);

  // Load profile values on opening settings
  const openSettings = () => {
    if (profile) {
      setName(profile.name);
      setCalTarget(profile.dailyCalorieTarget.toString());
      setWaterTarget(profile.dailyWaterTarget.toString());
      setSleepTarget(profile.dailySleepTarget.toString());
    }
    setProfileView('settings');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.userProfile.put({
      id: 1,
      name: name.trim() || 'Abdullah',
      age: profile?.age ?? 23,
      dailyCalorieTarget: parseInt(calTarget) || 2500,
      dailyWaterTarget: parseFloat(waterTarget) || 3.0,
      dailySleepTarget: parseFloat(sleepTarget) || 8.0,
      cleanStreak: profile?.cleanStreak ?? 0
    });
    setProfileView('main');
  };

  const handleAddJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalText.trim()) return;
    const dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    setJournalLogs(prev => [
      { date: dateStr, text: journalText.trim(), mood },
      ...prev
    ]);
    setJournalText('');
  };

  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const wt = parseFloat(weightInput) || 69.0;
    const dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    setWeightLogs(prev => [
      { date: dateStr, weight: wt },
      ...prev
    ]);
    
    // Also sync weight goal progress
    db.goals.where({ title: 'Gain Weight' }).first().then(g => {
      if (g?.id) {
        db.goals.update(g.id, { currentValue: wt });
      }
    });
  };

  // PWA Local Database JSON Backup Export
  const handleExportBackup = async () => {
    try {
      const data = {
        userProfile: await db.userProfile.toArray(),
        prayers: await db.prayers.toArray(),
        dopamineUrges: await db.dopamineUrges.toArray(),
        sleep: await db.sleep.toArray(),
        water: await db.water.toArray(),
        meals: await db.meals.toArray(),
        workouts: await db.workouts.toArray(),
        routines: await db.routines.toArray(),
        goals: await db.goals.toArray(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recovery-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup export failed:', err);
    }
  };

  // PWA Local Database JSON Backup Restore
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Populate tables
        if (json.userProfile) {
          await db.userProfile.clear();
          await db.userProfile.bulkPut(json.userProfile);
        }
        if (json.prayers) {
          await db.prayers.clear();
          await db.prayers.bulkPut(json.prayers);
        }
        if (json.sleep) {
          await db.sleep.clear();
          await db.sleep.bulkPut(json.sleep);
        }
        if (json.water) {
          await db.water.clear();
          await db.water.bulkPut(json.water);
        }
        if (json.meals) {
          await db.meals.clear();
          await db.meals.bulkPut(json.meals);
        }
        if (json.workouts) {
          await db.workouts.clear();
          await db.workouts.bulkPut(json.workouts);
        }
        if (json.routines) {
          await db.routines.clear();
          await db.routines.bulkPut(json.routines);
        }
        if (json.goals) {
          await db.goals.clear();
          await db.goals.bulkPut(json.goals);
        }
        if (json.dopamineUrges) {
          await db.dopamineUrges.clear();
          await db.dopamineUrges.bulkPut(json.dopamineUrges);
        }

        alert('Backup restored successfully!');
        window.location.reload(); // Refresh to reload cache queries
      } catch (err) {
        alert('Invalid backup file structure!');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* 1. Profile Main View */}
      {profileView === 'main' && (
        <>
          {/* Header Profile card */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col items-center justify-center bg-gradient-to-b from-[#0B0F19] to-slate-950 border border-slate-900/60 shadow-lg text-center relative overflow-hidden py-8">
            <div className="w-20 h-20 rounded-full border border-slate-800 flex items-center justify-center bg-gradient-to-tr from-[#161B2B] to-[#252E4B] mb-4 shadow-xl">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3A86FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h2 className="text-xl font-extrabold text-white font-heading tracking-wide">
              {profile?.name || 'Abdullah'}
            </h2>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Keep improving every day</p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500/10" />
              <span className="text-xs font-bold text-slate-200 mt-2">23</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Streak</span>
            </div>

            <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
              <Shield className="w-5 h-5 text-[#02C39A] fill-emerald-500/10" />
              <span className="text-xs font-bold text-slate-200 mt-2">{profile?.cleanStreak ?? 0}</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Clean Days</span>
            </div>

            <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
              <Activity className="w-5 h-5 text-[#3A86FF]" />
              <span className="text-xs font-bold text-slate-200 mt-2">87</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Best Score</span>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="flex flex-col bg-[#0B0F19]/60 border border-slate-900/60 rounded-3xl overflow-hidden mt-2">
            {[
              { label: 'My Journal', icon: BookOpen, action: () => setProfileView('journal') },
              { label: 'Weight Tracker', icon: Weight, action: () => setProfileView('weight') },
              { label: 'Settings', icon: Settings, action: openSettings },
              { label: 'Export JSON Backup', icon: Download, action: handleExportBackup, isButton: true },
            ].map((menu, idx) => {
              const Icon = menu.icon;
              return (
                <div 
                  key={idx}
                  onClick={menu.action}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-900/20 border-b border-slate-900/60 last:border-0 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3.5 text-slate-300">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold">{menu.label}</span>
                  </div>
                  {!menu.isButton && <ChevronRight className="w-4 h-4 text-slate-600" />}
                </div>
              );
            })}
            
            {/* Import Backup Menu wrapper */}
            <label className="flex items-center justify-between px-5 py-4 hover:bg-slate-900/20 cursor-pointer transition-colors">
              <div className="flex items-center gap-3.5 text-slate-300">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold">Import JSON Backup</span>
              </div>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportBackup} 
                className="hidden" 
              />
            </label>
          </div>
        </>
      )}

      {/* 2. Settings sub-view */}
      {profileView === 'settings' && (
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setProfileView('main')}
              className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-slate-200 font-heading">Settings</h1>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Profile Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-semibold"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Daily Calorie Target (kcal)</label>
              <input
                type="number"
                value={calTarget}
                onChange={(e) => setCalTarget(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Daily Water Target (Liters)</label>
              <input
                type="number"
                step="0.1"
                value={waterTarget}
                onChange={(e) => setWaterTarget(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Daily Sleep Target (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={sleepTarget}
                onChange={(e) => setSleepTarget(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </form>
      )}

      {/* 3. Journal sub-view */}
      {profileView === 'journal' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setProfileView('main')}
              className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-slate-200 font-heading">My Journal</h1>
          </div>

          <form onSubmit={handleAddJournal} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 bg-[#0B0F19]/80 border-slate-800/50">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold font-heading">Today's Entry</label>
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="How was your focus today? Document your challenges and wins..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 resize-none h-24 placeholder:text-slate-700 font-medium leading-relaxed"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Daily Mood</label>
              <div className="flex gap-2">
                {['great', 'good', 'neutral', 'anxious'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all border cursor-pointer",
                      mood === m 
                        ? "bg-[#3A86FF] border-[#3A86FF] text-white" 
                        : "bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!journalText.trim()}
              className="w-full py-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 disabled:bg-slate-850 disabled:text-slate-650 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Add Entry
            </button>
          </form>

          {/* Past entries list */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Past Entries</h3>
            {journalLogs.length > 0 ? (
              journalLogs.map((log, idx) => (
                <div key={idx} className="bg-[#0B0F19]/45 border border-slate-900/60 p-4 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#3A86FF] font-extrabold">{log.date}</span>
                    <span className="text-[8px] bg-slate-950 border border-slate-900 text-slate-500 px-1.5 py-0.5 rounded-full font-bold capitalize">
                      Mood: {log.mood}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">"{log.text}"</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-650 font-semibold border border-dashed border-slate-900/60 rounded-2xl">
                No entries saved yet. Start journaling to track your mental state.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Weight sub-view */}
      {profileView === 'weight' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setProfileView('main')}
              className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-slate-200 font-heading">Weight Tracker</h1>
          </div>

          <form onSubmit={handleAddWeight} className="glass-panel p-5 rounded-2xl flex items-center gap-3 bg-[#0B0F19]/80 border-slate-800/50">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5 font-bold">Log Current Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
            <button
              type="submit"
              className="p-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer mt-5"
            >
              Log
            </button>
          </form>

          {/* Weight history */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">History</h3>
            <div className="bg-[#0B0F19]/60 border border-slate-900/60 rounded-3xl overflow-hidden">
              {weightLogs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-4 border-b border-slate-900/60 last:border-0 text-xs">
                  <span className="text-slate-400 font-bold">{log.date}</span>
                  <span className="font-extrabold text-slate-200">{log.weight} kg</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
