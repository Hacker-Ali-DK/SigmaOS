'use client';

import React, { useState, useEffect } from 'react';
import { X, Droplet, Moon, Shield, Sparkles, Utensils, Dumbbell, BookOpen } from 'lucide-react';
import { useAppStore, getLocalDateString } from '@/lib/store';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { calculateSleepDuration } from '@/lib/scoring/scoring-service';

export default function QuickAddModal() {
  const { showAddModal, setShowAddModal, selectedDate } = useAppStore();
  const [activeSection, setActiveSection] = useState<'grid' | 'water' | 'urge' | 'sleep' | 'meal'>('grid');
  
  // Inputs
  const [waterAmount, setWaterAmount] = useState('0.25');
  const [urgeStrength, setUrgeStrength] = useState<'low' | 'medium' | 'high'>('low');
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
    await db.dopamineUrges.add({
      timestamp: Date.now(),
      strength: urgeStrength,
      triggers: urgeTriggers,
      notes: urgeNotes.trim() || undefined
    });
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

  const quickDeenLog = async () => {
    const log = await db.prayers.get(selectedDate) || {
      date: selectedDate,
      fajr: false,
      dhuhr: false,
      asr: false,
      maghrib: false,
      isha: false,
      quranMinutes: 0
    };
    
    // Toggle first unprayed or Fajr by default
    if (!log.fajr) log.fajr = true;
    else if (!log.dhuhr) log.dhuhr = true;
    else if (!log.asr) log.asr = true;
    else if (!log.maghrib) log.maghrib = true;
    else if (!log.isha) log.isha = true;
    
    await db.prayers.put(log);
    setShowAddModal(false);
  };

  const toggleTrigger = (trigger: string) => {
    setUrgeTriggers(prev => 
      prev.includes(trigger) ? prev.filter(t => t !== trigger) : [...prev, trigger]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md transition-opacity">
      <div 
        className="w-full max-w-md bg-[#0B0F19] rounded-t-3xl border-t border-slate-900 shadow-2xl overflow-hidden pb-safe animate-in slide-in-from-bottom duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-900/50">
          <h2 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3A86FF]" />
            {activeSection === 'grid' && 'Quick Log'}
            {activeSection === 'water' && 'Log Water'}
            {activeSection === 'urge' && 'Log Urge / Relapse Check'}
            {activeSection === 'sleep' && 'Log Sleep'}
            {activeSection === 'meal' && 'Log Meal'}
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
          {activeSection === 'grid' && (
            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => setActiveSection('water')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-cyan-950/20 border border-cyan-900/30 hover:border-cyan-500/30 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform mb-2">
                  <Droplet className="w-5 h-5 fill-cyan-400/10" />
                </div>
                <span className="text-xs text-slate-300 font-medium">Log Water</span>
              </button>

              <button 
                onClick={() => setActiveSection('sleep')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/30 hover:border-indigo-500/30 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform mb-2">
                  <Moon className="w-5 h-5 fill-indigo-400/10" />
                </div>
                <span className="text-xs text-slate-300 font-medium">Log Sleep</span>
              </button>

              <button 
                onClick={() => setActiveSection('urge')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-950/20 border border-rose-900/30 hover:border-rose-500/30 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform mb-2">
                  <Shield className="w-5 h-5 fill-rose-400/10" />
                </div>
                <span className="text-xs text-slate-300 font-medium">Log Urge</span>
              </button>

              <button 
                onClick={quickDeenLog}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 hover:border-emerald-500/30 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform mb-2">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-300 font-medium">Log Prayer</span>
              </button>

              <button 
                onClick={() => setActiveSection('meal')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-950/20 border border-amber-900/30 hover:border-amber-500/30 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform mb-2">
                  <Utensils className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-300 font-medium">Log Meal</span>
              </button>

              <div 
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/20 border border-slate-900/30 opacity-40"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400 mb-2">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-400 font-medium">Workout</span>
              </div>
            </div>
          )}

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
                className="w-full py-4 bg-[#E63946] hover:bg-[#E63946]/95 active:scale-98 text-white rounded-xl font-semibold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
              >
                Log Urge Logged
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
                <div className="flex justify-between px-1 mt-1.5 text-[10px] text-slate-500 font-bold uppercase">
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
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400 leading-relaxed font-semibold">
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

          {activeSection !== 'grid' && (
            <button 
              onClick={handleBack}
              className="w-full text-center mt-4 text-xs text-[#3A86FF] font-medium hover:underline cursor-pointer"
            >
              Back to options
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
