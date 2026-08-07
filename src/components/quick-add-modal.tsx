'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Droplet, Moon, Shield, Sparkles, Utensils, Dumbbell, BookOpen, CheckCircle2, Clock, XCircle, MinusCircle } from 'lucide-react';
import { useAppStore, getLocalDateString } from '@/lib/store';
import { db, type DetailedPrayerStatus, type PrayerDetail, getPrayerStatus, isPrayerCompleted } from '@/lib/db';
import { cn } from '@/lib/utils';
import { calculateSleepDuration } from '@/lib/scoring/scoring-service';

export default function QuickAddModal() {
  const { showAddModal, setShowAddModal, selectedDate } = useAppStore();
  const [activeSection, setActiveSection] = useState<'grid' | 'water' | 'urge' | 'sleep' | 'meal' | 'deen'>('grid');

  const currentPrayerLog = useLiveQuery(() => db.prayers.get(selectedDate), [selectedDate]);

  const handleSavePrayerStatus = async (field: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', newStatus: DetailedPrayerStatus) => {
    const existingLog = await db.prayers.get(selectedDate);
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const existingDetail = (existingLog && existingLog[field] && typeof existingLog[field] === 'object')
      ? (existingLog[field] as any)
      : {};

    const updatedDetail: PrayerDetail = {
      ...existingDetail,
      status: newStatus,
      completedTime: (newStatus === 'prayed_on_time' || newStatus === 'prayed_late') ? currentTimeStr : undefined
    };

    const updatedLog = {
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
    };

    await db.prayers.put(updatedLog);

    const routines = await db.routines.where({ date: selectedDate }).toArray();
    const targetRoutine = routines.find(r => r.taskName.toLowerCase() === field);
    if (targetRoutine?.id) {
      await db.routines.update(targetRoutine.id, {
        completed: isPrayerCompleted(newStatus)
      });
    }
  };
  
  // Inputs
  const [waterAmount, setWaterAmount] = useState('0.25');
  const [urgeStrength, setUrgeStrength] = useState<'low' | 'medium' | 'high'>('low');
  const [urgeOutcome, setUrgeOutcome] = useState<'resisted' | 'relapsed'>('resisted');
  const [urgeNotes, setUrgeNotes] = useState('');
  const [urgeTriggers, setUrgeTriggers] = useState<string[]>([]);
  const [sleepBedtime, setSleepBedtime] = useState('22:30');
  const [sleepWakeup, setSleepWakeup] = useState('06:30');
  const [sleepQualityRating, setSleepQualityRating] = useState('4');
  const [sleepAwakenings, setSleepAwakenings] = useState('');
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('500');
  const [mealProtein, setMealProtein] = useState('25');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'snack' | 'dinner'>('breakfast');

  const triggersList = ['Social Media', 'Loneliness', 'Stress', 'Boredom', 'Late Night', 'Fatigue'];

  useEffect(() => {
    if (!showAddModal) {
      setActiveSection('grid');
      // Reset inputs
      setMealName('');
      setUrgeNotes('');
      setUrgeTriggers([]);
      setUrgeOutcome('resisted');
      setSleepBedtime('22:30');
      setSleepWakeup('06:30');
      setSleepQualityRating('4');
      setSleepAwakenings('');
    }
  }, [showAddModal]);

  if (!showAddModal) return null;

  const handleBack = () => setActiveSection('grid');

  const logWater = async () => {
    const amt = parseFloat(waterAmount) || 0.25;
    const currentLog = await db.water.get(selectedDate);
    await db.water.put({
      date: selectedDate,
      amountLiters: Number(((currentLog?.amountLiters || 0) + amt).toFixed(2))
    });
    setShowAddModal(false);
  };

  const logUrge = async () => {
    const isResisted = urgeOutcome === 'resisted';
    await db.dopamineUrges.add({
      timestamp: Date.now(),
      strength: urgeStrength,
      triggers: urgeTriggers,
      notes: urgeNotes.trim() || undefined,
      resisted: isResisted
    });

    if (!isResisted) {
      await db.userProfile.update(1, { cleanStreak: 0 });
    }
    setShowAddModal(false);
  };

  const logSleep = async () => {
    if (!sleepBedtime || !sleepWakeup) return;
    const dur = calculateSleepDuration(sleepBedtime, sleepWakeup);
    const qualRating = parseFloat(sleepQualityRating) || 4.0;
    const awakeningsVal = sleepAwakenings.trim() ? parseInt(sleepAwakenings) : undefined;
    
    let bedtimeDateStr = selectedDate;
    if (sleepWakeup < sleepBedtime) {
      const prevDate = new Date(selectedDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, '0');
      const day = String(prevDate.getDate()).padStart(2, '0');
      bedtimeDateStr = `${year}-${month}-${day}`;
    }

    await db.sleep.put({
      date: selectedDate,
      totalHours: dur,
      bedtime: `${bedtimeDateStr}T${sleepBedtime}`,
      waketime: `${selectedDate}T${sleepWakeup}`,
      qualityRating: qualRating,
      qualityScore: qualRating * 20,
      awakenings: awakeningsVal,
      source: 'manual'
    });

    const routines = await db.routines.where({ date: selectedDate }).toArray();
    const sleepRoutine = routines.find(r => r.taskName === 'Sleep');
    if (sleepRoutine?.id) {
      await db.routines.update(sleepRoutine.id, { completed: true });
    }

    setShowAddModal(false);
  };

  const logMeal = async () => {
    if (!mealName.trim()) return;
    await db.meals.add({
      date: selectedDate,
      mealType,
      description: mealName.trim(),
      calories: parseInt(mealCalories) || 0,
      proteinGrams: parseInt(mealProtein) || 0
    });
    setShowAddModal(false);
  };

  // quickDeenLog removed — prayer logging is handled by handleSavePrayerStatus
  // using proper PrayerDetail object format (not legacy booleans).

  const toggleTrigger = (trigger: string) => {
    setUrgeTriggers(prev => 
      prev.includes(trigger) ? prev.filter(t => t !== trigger) : [...prev, trigger]
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes radial-spring {
          0% { opacity: 0; transform: translate(0, 0) scale(0.7); }
          100% { opacity: 1; transform: var(--target-transform) scale(1); }
        }
        .radial-item {
          opacity: 0;
          animation: radial-spring 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}} />

      {activeSection === 'grid' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03050C]/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowAddModal(false)}>
          <div className="relative w-[320px] h-[320px] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Center Anchor */}
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute z-20 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-b from-[#1C2541] to-[#0B0F19] shadow-[0_0_20px_rgba(58,134,255,0.4)] active:scale-90 transition-all cursor-pointer border border-[#3A86FF]/50 hover:shadow-[0_0_30px_rgba(58,134,255,0.6)] hover:scale-105 p-[2px]"
            >
              <div className="relative w-full h-full rounded-full overflow-hidden bg-[#0B0F19] flex items-center justify-center shadow-inner">
                <img 
                  src="/images/blue-dragon-icon.png" 
                  alt="Dragon" 
                  className="w-full h-full object-contain scale-[1.8] opacity-90 relative z-0" 
                />
              </div>
            </button>
            
            {/* Radial Items */}
            {[
              { id: 'sleep', label: 'Sleep', icon: Moon, angle: 270, color: 'text-indigo-400', bg: 'bg-[#0B0F19]', border: 'border-indigo-500/40' },
              { id: 'urge', label: 'Urge', icon: Shield, angle: 330, color: 'text-rose-400', bg: 'bg-[#0B0F19]', border: 'border-rose-500/40' },
              { id: 'meal', label: 'Meal', icon: Utensils, angle: 30, color: 'text-amber-400', bg: 'bg-[#0B0F19]', border: 'border-amber-500/40' },
              { id: 'workout', label: 'Workout', icon: Dumbbell, angle: 90, color: 'text-slate-400', bg: 'bg-[#0B0F19]', border: 'border-slate-500/40' },
              { id: 'water', label: 'Water', icon: Droplet, angle: 150, color: 'text-cyan-400', bg: 'bg-[#0B0F19]', border: 'border-cyan-500/40' },
              { id: 'deen', label: 'Prayer', icon: BookOpen, angle: 210, color: 'text-emerald-400', bg: 'bg-[#0B0F19]', border: 'border-emerald-500/40' },
            ].map((item, index) => {
              const radius = typeof window !== 'undefined' ? Math.min(120, window.innerWidth * 0.35) : 120;
              const x = Math.cos(item.angle * Math.PI / 180) * radius;
              const y = Math.sin(item.angle * Math.PI / 180) * radius;
              const Icon = item.icon;
              
              return (
                <button
                  key={item.id}
                  onClick={() => item.id !== 'workout' && setActiveSection(item.id as any)}
                  className="radial-item absolute flex flex-col items-center justify-center group z-10"
                  style={{ 
                    '--target-transform': `translate(${x}px, ${y}px)`,
                    animationDelay: `${index * 60}ms`
                  } as React.CSSProperties}
                >
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center border shadow-lg transition-transform group-hover:scale-110 bg-[#0B0F19]/80 backdrop-blur-md", item.border, item.color, item.id === 'workout' && "opacity-40")}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={cn("absolute top-16 text-micro font-bold tracking-wider uppercase whitespace-nowrap transition-opacity drop-shadow-md", item.color, item.id === 'workout' ? "opacity-20" : "opacity-0 group-hover:opacity-100")}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-md bg-[#0B0F19] rounded-t-3xl border-t border-slate-900 shadow-2xl overflow-hidden pb-safe animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-900/50">
              <h2 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3A86FF]" />
                {activeSection === 'water' && 'Log Water'}
                {activeSection === 'urge' && 'Log Urge / Relapse Check'}
                {activeSection === 'sleep' && 'Log Sleep'}
                {activeSection === 'meal' && 'Log Meal'}
                {activeSection === 'deen' && 'Log Prayer'}
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full bg-slate-900/50 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto no-scrollbar">

          {/* Water Panel */}
          {activeSection === 'water' && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                {['0.25', '0.5', '0.75', '1.0'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setWaterAmount(val)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border font-medium text-sm transition-colors cursor-pointer",
                      waterAmount === val 
                        ? "bg-[#3A86FF] border-[#3A86FF] text-white" 
                        : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                    )}
                  >
                    {val === '1.0' ? '1 Liter' : `${parseFloat(val) * 1000} ml`}
                  </button>
                ))}
              </div>
              <button 
                onClick={logWater}
                className="w-full py-4 mt-2 bg-[#3A86FF] hover:bg-[#3A86FF]/95 active:scale-98 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                Log Drink
              </button>
            </div>
          )}

          {/* Urge Panel */}
          {activeSection === 'urge' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Urge Strength</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((strength) => (
                    <button
                      key={strength}
                      type="button"
                      onClick={() => setUrgeStrength(strength)}
                      className={cn(
                        "flex-1 py-3 rounded-xl border text-sm font-semibold capitalize transition-all cursor-pointer",
                        urgeStrength === strength
                          ? strength === 'low' ? 'bg-[#02C39A] border-[#02C39A] text-white'
                            : strength === 'medium' ? 'bg-[#FFB703] border-[#FFB703] text-black'
                            : 'bg-[#E63946] border-[#E63946] text-white shadow-lg shadow-red-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      )}
                    >
                      {strength}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Triggers</label>
                <div className="flex flex-wrap gap-2">
                  {triggersList.map((trigger) => {
                    const isSelected = urgeTriggers.includes(trigger);
                    return (
                      <button
                        key={trigger}
                        type="button"
                        onClick={() => toggleTrigger(trigger)}
                        className={cn(
                          "px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer",
                          isSelected
                            ? "bg-[#3A86FF]/10 border-[#3A86FF] text-[#3A86FF]"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        )}
                      >
                        {trigger}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Outcome</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUrgeOutcome('resisted')}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      urgeOutcome === 'resisted'
                        ? "bg-[#02C39A] border-[#02C39A] text-white shadow-lg shadow-emerald-500/10"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Resisted Urge
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgeOutcome('relapsed')}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      urgeOutcome === 'relapsed'
                        ? "bg-[#E63946] border-[#E63946] text-white shadow-lg shadow-red-500/10"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    <XCircle className="w-4 h-4" />
                    Relapse Occurred
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Notes (Optional)</label>
                <textarea
                  value={urgeNotes}
                  onChange={(e) => setUrgeNotes(e.target.value)}
                  placeholder="What led to this urge? How are you countering it?"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#3A86FF] focus:outline-none text-sm text-slate-200 resize-none h-20 placeholder:text-slate-600"
                />
              </div>

              <button 
                onClick={logUrge}
                className={cn(
                  "w-full py-4 active:scale-98 text-white rounded-xl font-semibold shadow-lg transition-all cursor-pointer",
                  urgeOutcome === 'resisted'
                    ? "bg-[#02C39A] hover:bg-[#02C39A]/95 shadow-emerald-500/20"
                    : "bg-[#E63946] hover:bg-[#E63946]/95 shadow-red-500/20"
                )}
              >
                {urgeOutcome === 'resisted' ? 'Log Resisted Urge' : 'Log Relapse'}
              </button>
            </div>
          )}

          {/* Sleep Panel */}
          {activeSection === 'sleep' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Bedtime</label>
                  <input
                    type="time"
                    value={sleepBedtime}
                    onChange={(e) => setSleepBedtime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#3A86FF] focus:outline-none text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Wake-up Time</label>
                  <input
                    type="time"
                    value={sleepWakeup}
                    onChange={(e) => setSleepWakeup(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#3A86FF] focus:outline-none text-slate-100 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Sleep Quality</label>
                <div className="flex gap-1 bg-slate-900 p-1 rounded-xl">
                  {['1', '2', '3', '4', '5'].map((rating) => {
                    const isSelected = sleepQualityRating === rating;
                    const labels = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];
                    return (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setSleepQualityRating(rating)}
                        title={labels[parseInt(rating) - 1]}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          isSelected ? "bg-[#3A86FF] text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {rating}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between px-1 mt-1.5 text-micro text-slate-500 font-bold uppercase">
                  <span>Very Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Awakenings (Optional)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Not Tracked"
                  value={sleepAwakenings}
                  onChange={(e) => setSleepAwakenings(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#3A86FF] focus:outline-none text-slate-100 font-semibold"
                />
              </div>

              {/* Calculated duration feedback */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Calculated Sleep Duration:</span>
                <span className="text-indigo-400 font-extrabold text-sm">
                  {calculateSleepDuration(sleepBedtime, sleepWakeup)} hours
                </span>
              </div>

              {calculateSleepDuration(sleepBedtime, sleepWakeup) > 16 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-micro text-amber-400 leading-relaxed font-semibold">
                  ⚠️ Note: This is an unusually long sleep duration (&gt;16 hours). Please verify your times.
                </div>
              )}

              <button 
                onClick={logSleep}
                className="w-full py-4 mt-2 bg-[#3A86FF] hover:bg-[#3A86FF]/95 active:scale-98 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                Log Sleep Record
              </button>
            </div>
          )}

          {/* Meal Panel */}
          {activeSection === 'meal' && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl">
                {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMealType(type)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer",
                      mealType === type ? "bg-[#0B0F19] text-[#3A86FF] shadow-sm" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Meal Description</label>
                <input
                  type="text"
                  placeholder="e.g. Oatmeal with bananas and honey"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#3A86FF] focus:outline-none text-sm text-slate-100 placeholder:text-slate-600"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Calories (kcal)</label>
                  <input
                    type="number"
                    value={mealCalories}
                    onChange={(e) => setMealCalories(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#3A86FF] focus:outline-none text-sm text-slate-100 font-bold"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-medium">Protein (g)</label>
                  <input
                    type="number"
                    value={mealProtein}
                    onChange={(e) => setMealProtein(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#3A86FF] focus:outline-none text-sm text-slate-100 font-bold"
                  />
                </div>
              </div>

              <button 
                onClick={logMeal}
                disabled={!mealName.trim()}
                className="w-full py-4 mt-2 bg-[#3A86FF] hover:bg-[#3A86FF]/95 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none active:scale-98 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                Add Meal
              </button>
            </div>
          )}

          {/* Deen / Prayer Panel */}
          {activeSection === 'deen' && (
            <div className="flex flex-col gap-3">
              <span className="text-xs text-slate-400 font-semibold mb-1 block">
                Select detailed status for today's prayers:
              </span>
              {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((field) => {
                const rawVal = currentPrayerLog?.[field];
                const currentStatus = getPrayerStatus(rawVal);
                const detail = (rawVal && typeof rawVal === 'object') ? (rawVal as PrayerDetail) : null;
                const completedTime = detail?.completedTime;

                return (
                  <div key={field} className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 capitalize font-heading flex items-center gap-1.5">
                        {field}
                        {completedTime && (
                          <span className="text-micro text-slate-400 font-normal font-mono">({completedTime})</span>
                        )}
                      </span>
                      <span className="text-micro font-semibold px-2 py-0.5 rounded-full capitalize bg-slate-950 text-slate-400 border border-slate-800">
                        {currentStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { status: 'prayed_on_time', label: 'On Time', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                        { status: 'prayed_late', label: 'Late', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                        { status: 'missed', label: 'Missed', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
                        { status: 'not_tracked', label: 'Untracked', color: 'bg-slate-800/50 text-slate-400 border-slate-700/40' },
                      ].map((item) => {
                        const isSelected = currentStatus === item.status;
                        return (
                          <button
                            key={item.status}
                            type="button"
                            onClick={() => handleSavePrayerStatus(field, item.status as DetailedPrayerStatus)}
                            className={cn(
                              "py-1.5 rounded-xl text-micro font-bold border transition-all cursor-pointer text-center",
                              isSelected
                                ? item.color + " ring-1 ring-white/20 font-extrabold"
                                : "bg-slate-950/60 border-slate-900 text-slate-400 hover:text-slate-200"
                            )}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

            <button 
              onClick={handleBack}
              className="w-full text-center mt-4 text-xs text-[#3A86FF] font-medium hover:underline cursor-pointer"
            >
              Back to options
            </button>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
