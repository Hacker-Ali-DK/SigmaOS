'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, User, Settings, Bell, Database, Info, Flame, Shield, Activity, ChevronRight, BookOpen, Weight, Save, Download, Upload } from 'lucide-react';
import { db, migrateLegacyPrayerLog } from '@/lib/db';
import { useAppStore, getLocalDateString } from '@/lib/store';
import { calculateScoresForDate } from '@/lib/scoring/scoring-service';
import { cn } from '@/lib/utils';

export default function ProfileView() {
  const [profileView, setProfileView] = useState<'main' | 'journal' | 'weight' | 'settings'>('main');

  // Queries
  const profile = useLiveQuery(() => db.userProfile.get(1));

  // Dynamic calculation for Streak and Best Score from actual DB logs
  const dynamicStats = useLiveQuery(async () => {
    try {
      // 1. Calculate active daily routine streak
      const allRoutines = await db.routines.toArray();
      const completedDates = new Set(
        allRoutines.filter(r => r.completed).map(r => r.date)
      );

      let currentStreak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (completedDates.has(dateStr)) {
          currentStreak++;
        } else {
          // If today has no completed tasks yet, don't break streak on today
          if (i === 0) continue;
          break;
        }
      }

      // 2. Calculate best score across historical dates
      const [prayersLogs, sleepLogs, waterLogs, mealLogs] = await Promise.all([
        db.prayers.toArray(),
        db.sleep.toArray(),
        db.water.toArray(),
        db.meals.toArray()
      ]);

      const datesWithLogs = Array.from(new Set([
        ...allRoutines.map(r => r.date),
        ...prayersLogs.map(p => p.date),
        ...sleepLogs.map(s => s.date),
        ...waterLogs.map(w => w.date),
        ...mealLogs.map(m => m.date)
      ]));

      let maxScore = 0;
      for (const dStr of datesWithLogs) {
        const scores = await calculateScoresForDate(dStr);
        if (scores.overallAlignment > maxScore) {
          maxScore = scores.overallAlignment;
        }
      }

      return {
        streak: currentStreak,
        bestScore: maxScore
      };
    } catch (e) {
      return { streak: 0, bestScore: 0 };
    }
  }, [], { streak: 0, bestScore: 0 });
  
  // Settings Form State
  const [name, setName] = useState('');
  const [calTarget, setCalTarget] = useState('2500');
  const [waterTarget, setWaterTarget] = useState('3.0');
  const [sleepTarget, setSleepTarget] = useState('8.0');
  const [screenTarget, setScreenTarget] = useState('4.0');

  // Prayer Settings Form State
  const [lat, setLat] = useState('24.8607');
  const [lng, setLng] = useState('67.0011');
  const [city, setCity] = useState('Karachi');
  const [country, setCountry] = useState('Pakistan');
  const [tz, setTz] = useState('Asia/Karachi');
  const [prayerMethod, setPrayerMethod] = useState<'karachi' | 'mwl' | 'umm_al_qura' | 'isna'>('karachi');
  const [asrMethod, setAsrMethod] = useState<'standard' | 'hanafi'>('standard');
  const [ishaPolicy, setIshaPolicy] = useState<'midnight' | 'fajr'>('fajr');

  // Journal State
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState<'great' | 'good' | 'neutral' | 'anxious'>('good');
  const [energy, setEnergy] = useState<'low' | 'medium' | 'high'>('medium');
  const [screenHours, setScreenHours] = useState('2.0');
  const [productiveScreenHours, setProductiveScreenHours] = useState('4.0');

  const journalLogs = useLiveQuery(async () => {
    const list = await db.journal.toArray();
    return list.sort((a, b) => b.date.localeCompare(a.date));
  });

  // Weight State
  const [weightInput, setWeightInput] = useState('69.0');
  const weightLogs = useLiveQuery(async () => {
    const list = await db.weight.toArray();
    return list.sort((a, b) => b.date.localeCompare(a.date));
  });

  // Load profile values on opening settings
  const openSettings = () => {
    if (profile) {
      setName(profile.name);
      setCalTarget(profile.dailyCalorieTarget.toString());
      setWaterTarget(profile.dailyWaterTarget.toString());
      setSleepTarget(profile.dailySleepTarget.toString());
      setScreenTarget((profile.dailyScreenTimeTarget ?? 4.0).toString());
      // Step 3 settings
      setLat((profile.latitude ?? 24.8607).toString());
      setLng((profile.longitude ?? 67.0011).toString());
      setCity(profile.city ?? 'Karachi');
      setCountry(profile.country ?? 'Pakistan');
      setTz(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Karachi');
      setPrayerMethod(profile.prayerMethod ?? 'karachi');
      setAsrMethod(profile.asrMethod ?? 'standard');
      setIshaPolicy(profile.ishaPolicy ?? 'fajr');
    }
    setProfileView('settings');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    const parsedLat = parseFloat(lat);
    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      alert("Latitude must be a valid number between -90 and 90.");
      return;
    }

    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      alert("Longitude must be a valid number between -180 and 180.");
      return;
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch (err) {
      alert(`"${tz}" is not a valid IANA timezone identifier.`);
      return;
    }

    await db.userProfile.put({
      id: 1,
      name: name.trim() || 'Abdullah',
      age: profile?.age ?? 23,
      dailyCalorieTarget: parseInt(calTarget) || 2500,
      dailyWaterTarget: parseFloat(waterTarget) || 3.0,
      dailySleepTarget: parseFloat(sleepTarget) || 8.0,
      dailyScreenTimeTarget: parseFloat(screenTarget) || 4.0,
      cleanStreak: profile?.cleanStreak ?? 0,
      // Step 3 settings
      latitude: parsedLat,
      longitude: parsedLng,
      city: city.trim() || 'Karachi',
      country: country.trim() || 'Pakistan',
      timezone: tz.trim(),
      prayerMethod,
      asrMethod,
      ishaPolicy
    });
    setProfileView('main');
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalText.trim()) return;
    const dateStr = getLocalDateString();
    await db.journal.put({
      date: dateStr,
      text: journalText.trim(),
      mood,
      energy,
      screenHours: parseFloat(screenHours) || 0,
      productiveScreenHours: parseFloat(productiveScreenHours) || 0
    });
    setJournalText('');
  };

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const wt = parseFloat(weightInput) || 69.0;
    const dateStr = getLocalDateString();
    await db.weight.put({
      date: dateStr,
      weight: wt
    });
    
    // Also sync weight goal progress
    db.goals.where({ title: 'Gain Weight' }).first().then(g => {
      if (g?.id) {
        db.goals.update(g.id, { currentValue: wt });
      }
    });
  };

  // PWA Local Database JSON Backup Export
  // PWA Local Database JSON Backup Export
  const handleExportBackup = async () => {
    try {
      const data = {
        version: 5,
        exportedAt: new Date().toISOString(),
        userProfile: await db.userProfile.toArray(),
        prayers: await db.prayers.toArray(),
        dopamineUrges: await db.dopamineUrges.toArray(),
        sleep: await db.sleep.toArray(),
        water: await db.water.toArray(),
        meals: await db.meals.toArray(),
        workouts: await db.workouts.toArray(),
        routines: await db.routines.toArray(),
        goals: await db.goals.toArray(),
        journal: await db.journal.toArray(),
        weight: await db.weight.toArray(),
        naps: await db.naps.toArray(),
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
        if (!json || typeof json !== 'object') {
          throw new Error('Invalid JSON payload');
        }

        const tables = [
          { key: 'userProfile', store: db.userProfile },
          { key: 'sleep', store: db.sleep },
          { key: 'water', store: db.water },
          { key: 'meals', store: db.meals },
          { key: 'workouts', store: db.workouts },
          { key: 'routines', store: db.routines },
          { key: 'goals', store: db.goals },
          { key: 'dopamineUrges', store: db.dopamineUrges },
          { key: 'journal', store: db.journal },
          { key: 'weight', store: db.weight },
          { key: 'naps', store: db.naps },
        ];

        // Prayers table handling with lossless migration
        if (Array.isArray(json.prayers)) {
          await db.prayers.clear();
          const migrated = json.prayers.map((p: any) => migrateLegacyPrayerLog(p));
          if (migrated.length > 0) {
            await db.prayers.bulkPut(migrated);
          }
        }

        // Generic safe table population
        for (const t of tables) {
          if (Array.isArray(json[t.key])) {
            await t.store.clear();
            if (json[t.key].length > 0) {
              await (t.store as any).bulkPut(json[t.key]);
            }
          }
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
          <div className="relative w-full rounded-3xl overflow-hidden mt-2 bg-[#1E2328] shadow-2xl shadow-black/50 p-8 flex flex-col items-center justify-center text-center">
            <div className="absolute inset-0 bg-[url('/images/dashboard-hero.png')] bg-cover bg-[center_top] bg-no-repeat opacity-40 mix-blend-luminosity"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent"></div>
            
            <div className="relative z-10 w-24 h-24 rounded-full border border-slate-700/50 flex items-center justify-center bg-[#0A0A0A]/80 mb-4 shadow-xl backdrop-blur-sm">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D7B88C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h2 className="relative z-10 text-2xl font-extrabold text-white font-heading tracking-[0.15em] uppercase">
              {profile?.name || 'SIGMA'}
            </h2>
            <p className="relative z-10 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">
              Keep improving every day
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="bg-[#0A0A0A] border border-[#1E2328] p-4 rounded-3xl flex flex-col items-center justify-center text-center shadow-lg">
              <Flame className="w-6 h-6 text-orange-500 mb-2" />
              <span className="text-xl font-extrabold text-slate-200 font-heading">{dynamicStats?.streak ?? 0}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Streak</span>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1E2328] p-4 rounded-3xl flex flex-col items-center justify-center text-center shadow-lg">
              <Shield className="w-6 h-6 text-[#02C39A] mb-2" />
              <span className="text-xl font-extrabold text-slate-200 font-heading">{profile?.cleanStreak ?? 0}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Clean Days</span>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1E2328] p-4 rounded-3xl flex flex-col items-center justify-center text-center shadow-lg">
              <Activity className="w-6 h-6 text-[#D7B88C] mb-2" />
              <span className="text-xl font-extrabold text-slate-200 font-heading">{dynamicStats?.bestScore ?? 0}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Best Score</span>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="flex flex-col bg-[#0A0A0A] border border-[#1E2328] rounded-3xl overflow-hidden mt-4 shadow-lg">
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
                  className="flex items-center justify-between px-6 py-5 hover:bg-[#1E2328] border-b border-[#1E2328] last:border-0 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4 text-slate-200">
                    <Icon className="w-5 h-5 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">{menu.label}</span>
                  </div>
                  {!menu.isButton && <ChevronRight className="w-4 h-4 text-slate-600" />}
                </div>
              );
            })}
            
            {/* Import Backup Menu wrapper */}
            <label className="flex items-center justify-between px-6 py-5 hover:bg-[#1E2328] cursor-pointer transition-colors">
              <div className="flex items-center gap-4 text-slate-200">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Import JSON Backup</span>
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
              className="p-2 rounded-xl bg-[#1E2328]/40 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-slate-200 font-heading tracking-widest uppercase">Settings</h1>
          </div>

          <div className="p-6 rounded-3xl flex flex-col gap-5 bg-[#0A0A0A] border border-[#1E2328] shadow-xl">
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Profile Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
              />
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Daily Calorie Target (kcal)</label>
              <input
                type="number"
                value={calTarget}
                onChange={(e) => setCalTarget(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
              />
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Daily Water Target (Liters)</label>
              <input
                type="number"
                step="0.1"
                value={waterTarget}
                onChange={(e) => setWaterTarget(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
              />
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Daily Sleep Target (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={sleepTarget}
                onChange={(e) => setSleepTarget(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
              />
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Daily Screen Time Limit (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={screenTarget}
                onChange={(e) => setScreenTarget(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
              />
            </div>

            <hr className="border-[#1E2328] my-2" />
            
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest block font-heading">Location Configurations</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Latitude</label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Longitude</label>
                <input
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Timezone (IANA)</label>
              <input
                type="text"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                placeholder="e.g. Asia/Karachi"
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
              />
            </div>

            <hr className="border-[#1E2328] my-2" />

            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest block font-heading">Prayer & Deen Settings</h3>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Calculation Method</label>
              <select
                value={prayerMethod}
                onChange={(e) => setPrayerMethod(e.target.value as any)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner appearance-none"
              >
                <option value="karachi">Karachi (University of Islamic Sciences)</option>
                <option value="mwl">Muslim World League (MWL)</option>
                <option value="isna">ISNA (North America)</option>
                <option value="umm_al_qura">Umm al-Qura (Makkah)</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Asr Jurisprudence</label>
              <select
                value={asrMethod}
                onChange={(e) => setAsrMethod(e.target.value as any)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner appearance-none"
              >
                <option value="standard">Standard (Shafi'i, Maliki, Hanbali)</option>
                <option value="hanafi">Hanafi</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Isha End-Time Policy</label>
              <select
                value={ishaPolicy}
                onChange={(e) => setIshaPolicy(e.target.value as any)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner appearance-none"
              >
                <option value="midnight">Solar Midnight</option>
                <option value="fajr">Next Fajr</option>
              </select>
              <p className="text-[9px] text-slate-500 mt-2 leading-relaxed font-bold tracking-widest uppercase">
                {ishaPolicy === 'midnight' 
                  ? "Solar Midnight: Isha prayer window ends at the midpoint between sunset and the next sunrise. (Habit tracking default)"
                  : "Next Fajr: Isha prayer window ends when the next day's Fajr begins."}
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-4 mt-4 bg-[#D7B88C] hover:bg-[#D7B88C]/90 active:scale-95 text-[#0A0A0A] rounded-2xl text-[10px] uppercase tracking-widest font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#D7B88C]/20"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>

            <button
              type="button"
              onClick={async () => {
                if (confirm("Are you sure you want to delete all local data and reset the app? This cannot be undone.")) {
                  await db.delete();
                  window.location.reload();
                }
              }}
              className="w-full py-4 bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 active:scale-95 text-rose-500 rounded-2xl text-[10px] uppercase tracking-widest font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
            >
              Reset App Data
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
              className="p-2 rounded-xl bg-[#1E2328]/40 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#D7B88C] cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-slate-200 font-heading tracking-widest uppercase">My Journal</h1>
          </div>

          <form onSubmit={handleAddJournal} className="p-5 rounded-3xl flex flex-col gap-5 bg-[#0A0A0A] border border-[#1E2328] shadow-xl">
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Today's Entry</label>
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="How was your focus today? Document your challenges and wins..."
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 resize-none h-28 placeholder:text-slate-700 font-medium leading-relaxed shadow-inner"
              />
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Daily Mood</label>
              <div className="flex gap-2">
                {['great', 'good', 'neutral', 'anxious'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m as any)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border cursor-pointer",
                      mood === m 
                        ? "bg-[#D7B88C] border-[#D7B88C] text-[#0A0A0A] shadow-md shadow-[#D7B88C]/10" 
                        : "bg-[#0A0A0A] border-[#1E2328] text-slate-500 hover:text-slate-300 shadow-inner"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Daily Energy</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map((eLevel) => (
                  <button
                    key={eLevel}
                    type="button"
                    onClick={() => setEnergy(eLevel as any)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border cursor-pointer",
                      energy === eLevel 
                        ? "bg-slate-200 border-slate-200 text-[#0A0A0A] shadow-md shadow-slate-200/10" 
                        : "bg-[#0A0A0A] border-[#1E2328] text-slate-500 hover:text-slate-300 shadow-inner"
                    )}
                  >
                    {eLevel}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Rec. Screen (Hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={screenHours}
                  onChange={(e) => setScreenHours(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Prod. Screen (Hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={productiveScreenHours}
                  onChange={(e) => setProductiveScreenHours(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!journalText.trim()}
              className="w-full py-4 mt-2 bg-[#D7B88C] hover:bg-[#D7B88C]/90 active:scale-95 disabled:bg-[#1E2328] disabled:text-slate-600 disabled:cursor-not-allowed text-[#0A0A0A] rounded-2xl text-[10px] uppercase tracking-widest font-extrabold transition-all cursor-pointer shadow-lg shadow-[#D7B88C]/20"
            >
              Add Entry
            </button>
          </form>

          {/* Past entries list */}
          <div className="flex flex-col gap-4 mt-2">
            <h3 className="text-[9px] text-slate-500 font-bold uppercase tracking-widest ml-1">Past Entries</h3>
            {journalLogs && journalLogs.length > 0 ? (
              journalLogs.map((log, idx) => (
                <div key={idx} className="bg-[#0A0A0A] border border-[#1E2328] p-5 rounded-3xl flex flex-col gap-3 shadow-md">
                  <div className="flex items-center justify-between font-heading">
                    <span className="text-xs text-[#D7B88C] font-extrabold tracking-widest">{formatEntryDate(log.date)}</span>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <span className="text-[8px] bg-[#1E2328]/50 border border-[#1E2328] text-slate-400 px-2 py-1 rounded-md font-bold uppercase tracking-widest">
                        Mood: {log.mood}
                      </span>
                      {log.energy && (
                        <span className="text-[8px] bg-[#1E2328]/50 border border-[#1E2328] text-slate-400 px-2 py-1 rounded-md font-bold uppercase tracking-widest">
                          Energy: {log.energy}
                        </span>
                      )}
                      {log.screenHours !== undefined && (
                        <span className="text-[8px] bg-[#1E2328]/50 border border-[#1E2328] text-slate-400 px-2 py-1 rounded-md font-bold uppercase tracking-widest">
                          Rec: {log.screenHours}h
                        </span>
                      )}
                      {log.productiveScreenHours !== undefined && log.productiveScreenHours > 0 && (
                        <span className="text-[8px] bg-[#1E2328]/50 border border-[#1E2328] text-slate-400 px-2 py-1 rounded-md font-bold uppercase tracking-widest">
                          Prod: {log.productiveScreenHours}h
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium italic mt-1 border-l-2 border-[#1E2328] pl-3">"{log.text}"</p>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-[10px] text-slate-500 font-bold uppercase tracking-widest border border-dashed border-[#1E2328] rounded-3xl bg-[#1E2328]/10">
                No entries saved yet.
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
              className="p-2 rounded-xl bg-[#1E2328]/40 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#D7B88C] cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-slate-200 font-heading tracking-widest uppercase">Weight Tracker</h1>
          </div>

          <form onSubmit={handleAddWeight} className="p-5 rounded-3xl flex items-center gap-3 bg-[#0A0A0A] border border-[#1E2328] shadow-xl">
            <div className="flex-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Log Current Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E2328] focus:border-slate-500 focus:outline-none rounded-2xl text-xs text-slate-200 font-extrabold shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="p-4 bg-[#D7B88C] hover:bg-[#D7B88C]/90 active:scale-95 text-[#0A0A0A] rounded-2xl text-[10px] uppercase tracking-widest font-extrabold transition-all cursor-pointer mt-5 shadow-lg shadow-[#D7B88C]/20"
            >
              Log
            </button>
          </form>

          {/* Weight history */}
          <div className="flex flex-col gap-4 mt-2">
            <h3 className="text-[9px] text-slate-500 font-bold uppercase tracking-widest ml-1">History</h3>
            <div className="bg-[#0A0A0A] border border-[#1E2328] rounded-3xl overflow-hidden shadow-md">
              {weightLogs && weightLogs.length > 0 ? (
                weightLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between px-6 py-5 border-b border-[#1E2328] last:border-0 hover:bg-[#1E2328]/50 transition-colors">
                    <span className="text-slate-400 font-bold text-xs tracking-wider">{formatEntryDate(log.date)}</span>
                    <span className="text-lg font-extrabold text-slate-200 font-heading tracking-tight">{log.weight} <span className="text-[10px] text-slate-500 font-sans ml-0.5">kg</span></span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-dashed border-[#1E2328] bg-[#1E2328]/10">
                  No weight logs saved yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const formatEntryDate = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  } catch (e) {
    return dateStr;
  }
};
