'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ArrowLeft, Calendar, Moon, Sparkles, Plus, Trash2, Edit2, 
  Clock, AlertTriangle, Check, BookOpen, Coffee, Award, X 
} from 'lucide-react';
import { db, type SleepLog, type NapLog } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { calculateSleepDuration, calculateDailySleepScore } from '@/lib/scoring/scoring-service';

function formatMinsToTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

interface SleepViewProps {
  onBack: () => void;
}

export default function SleepView({ onBack }: SleepViewProps) {
  const { selectedDate } = useAppStore();

  // Queries
  const sleepLog = useLiveQuery(() => db.sleep.get(selectedDate));
  const naps = useLiveQuery(() => db.naps.where({ date: selectedDate }).toArray()) || [];
  const profile = useLiveQuery(() => db.userProfile.get(1));
  const recentLogs = useLiveQuery(() => db.sleep.orderBy('date').reverse().limit(7).toArray()) || [];

  const sleepTarget = profile?.dailySleepTarget || 8.0;

  // Night Sleep Form State
  const [showNightForm, setShowNightForm] = useState(false);
  const [editingNightLog, setEditingNightLog] = useState<SleepLog | null>(null);
  const [nightBedtime, setNightBedtime] = useState('22:30');
  const [nightWakeup, setNightWakeup] = useState('06:30');
  const [nightQuality, setNightQuality] = useState('4');
  const [nightAwakenings, setNightAwakenings] = useState('');
  const [nightNotes, setNightNotes] = useState('');
  const [confirmLongSleep, setConfirmLongSleep] = useState(false);

  // Nap Form State
  const [showNapForm, setShowNapForm] = useState(false);
  const [editingNap, setEditingNap] = useState<NapLog | null>(null);
  const [napStart, setNapStart] = useState('14:00');
  const [napEnd, setNapEnd] = useState('14:30');
  const [napQuality, setNapQuality] = useState('3');
  const [napNotes, setNapNotes] = useState('');

  // Auto populate form when opening edit modes
  useEffect(() => {
    if (editingNightLog) {
      const getRawTime = (s?: string) => s && s.includes('T') ? s.split('T')[1] : (s || '22:30');
      setNightBedtime(getRawTime(editingNightLog.bedtime));
      setNightWakeup(getRawTime(editingNightLog.waketime));
      setNightQuality(String(editingNightLog.qualityRating || Math.round(editingNightLog.qualityScore / 20) || 4));
      setNightAwakenings(editingNightLog.awakenings !== undefined ? String(editingNightLog.awakenings) : '');
      setNightNotes(editingNightLog.notes || '');
      setConfirmLongSleep(false);
    } else {
      setNightBedtime('22:30');
      setNightWakeup('06:30');
      setNightQuality('4');
      setNightAwakenings('');
      setNightNotes('');
      setConfirmLongSleep(false);
    }
  }, [editingNightLog]);

  useEffect(() => {
    if (editingNap) {
      setNapStart(editingNap.startTime);
      setNapEnd(editingNap.endTime);
      setNapQuality(String(editingNap.qualityRating || 3));
      setNapNotes(editingNap.notes || '');
    } else {
      setNapStart('14:00');
      setNapEnd('14:30');
      setNapQuality('3');
      setNapNotes('');
    }
  }, [editingNap]);

  const calcDuration = calculateSleepDuration(nightBedtime, nightWakeup);
  const isUnusuallyLong = calcDuration > 16;

  // Night Sleep Actions
  const handleSaveNightSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nightBedtime || !nightWakeup) return;
    if (isUnusuallyLong && !confirmLongSleep) return;

    let bedtimeDateStr = selectedDate;
    if (nightWakeup < nightBedtime) {
      const prevDate = new Date(selectedDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, '0');
      const day = String(prevDate.getDate()).padStart(2, '0');
      bedtimeDateStr = `${year}-${month}-${day}`;
    }

    const val = parseFloat(nightQuality) || 4;
    const awakes = nightAwakenings.trim() ? parseInt(nightAwakenings) : undefined;

    await db.sleep.put({
      date: selectedDate,
      totalHours: calcDuration,
      bedtime: `${bedtimeDateStr}T${nightBedtime}`,
      waketime: `${selectedDate}T${nightWakeup}`,
      qualityRating: val,
      qualityScore: val * 20,
      awakenings: awakes,
      notes: nightNotes.trim() || undefined,
      source: 'manual'
    });

    // Mark sleep routine task as completed
    const routines = await db.routines.where({ date: selectedDate }).toArray();
    const sleepRoutine = routines.find(r => r.taskName === 'Sleep');
    if (sleepRoutine?.id) {
      await db.routines.update(sleepRoutine.id, { completed: true });
    }

    setShowNightForm(false);
    setEditingNightLog(null);
  };

  const handleDeleteNightSleep = async () => {
    if (confirm("Are you sure you want to delete today's nighttime sleep record?")) {
      await db.sleep.where({ date: selectedDate }).delete();
      
      // Uncheck sleep routine task
      const routines = await db.routines.where({ date: selectedDate }).toArray();
      const sleepRoutine = routines.find(r => r.taskName === 'Sleep');
      if (sleepRoutine?.id) {
        await db.routines.update(sleepRoutine.id, { completed: false });
      }
    }
  };

  // Nap Actions
  const handleSaveNap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!napStart || !napEnd) return;

    const [sH, sM] = napStart.split(':').map(Number);
    const [eH, eM] = napEnd.split(':').map(Number);
    let startMins = sH * 60 + sM;
    let endMins = eH * 60 + eM;
    
    let diffMins = 0;
    if (endMins < startMins) {
      diffMins = (24 * 60 - startMins) + endMins;
    } else {
      diffMins = endMins - startMins;
    }
    const napMins = diffMins;

    const napData: NapLog = {
      date: selectedDate,
      startTime: napStart,
      endTime: napEnd,
      durationMinutes: napMins,
      qualityRating: parseFloat(napQuality) || 3,
      notes: napNotes.trim() || undefined,
      source: 'manual'
    };

    if (editingNap?.id) {
      await db.naps.update(editingNap.id, napData);
    } else {
      await db.naps.add(napData);
    }

    setShowNapForm(false);
    setEditingNap(null);
  };

  const handleDeleteNap = async (id?: number) => {
    if (!id) return;
    if (confirm("Delete this nap?")) {
      await db.naps.delete(id);
    }
  };

  // 24 Hour Sleep Math
  const totalNightSleep = sleepLog?.totalHours || 0;
  const totalNapMins = naps.reduce((sum, n) => sum + n.durationMinutes, 0);
  const totalNapHours = Number((totalNapMins / 60).toFixed(2));
  const total24HourSleep = Number((totalNightSleep + totalNapHours).toFixed(2));

  // Sleep Score Calculation
  const sleepScoreDetail = calculateDailySleepScore(sleepLog, sleepTarget);

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
            Sleep & Recovery
          </h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setEditingNightLog(sleepLog || null);
              setShowNightForm(true);
            }}
            className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <Moon className="w-3.5 h-3.5 text-[#3A86FF]" />
            Night Sleep
          </button>
          <button 
            onClick={() => {
              setEditingNap(null);
              setShowNapForm(true);
            }}
            className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 text-[#02C39A]" />
            Add Nap
          </button>
        </div>
      </div>

      {/* Main Score & Total Sleep Circle Card */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/20 via-[#0B0F19] to-slate-950 border border-indigo-500/10 shadow-lg text-center relative overflow-hidden py-8">
        <div className="flex items-center justify-center gap-8 w-full max-w-xs">
          {/* 24h Sleep Duration Indicator */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-slate-900/60 border border-indigo-500/20 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-white">{total24HourSleep}h</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">24h Total</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-2">Sleep Duration</span>
          </div>

          {/* Sleep Score Indicator */}
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  className="stroke-slate-900"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    sleepScoreDetail.status === 'insufficient' ? "stroke-slate-700" : "stroke-indigo-500"
                  )}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 38}
                  strokeDashoffset={2 * Math.PI * 38 * (1 - (sleepScoreDetail.status === 'insufficient' ? 0 : sleepScoreDetail.score) / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                {sleepScoreDetail.status === 'insufficient' ? (
                  <span className="text-xs font-bold text-slate-500">N/A</span>
                ) : (
                  <>
                    <span className="text-2xl font-extrabold text-white font-heading tracking-tight">
                      {sleepScoreDetail.score}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold">/100</span>
                  </>
                )}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-1">Sleep Score</span>
          </div>
        </div>

        {sleepScoreDetail.status !== 'insufficient' && (
          <div className="mt-4 flex flex-col items-center">
            <span className="text-[9px] text-[#4CC9F0] font-bold uppercase tracking-wider">
              Based on {sleepScoreDetail.trackedCount} of {sleepScoreDetail.totalCount} factors
            </span>
            {sleepScoreDetail.recommendation && (
              <p className="text-[11px] text-slate-400 mt-2 max-w-sm px-4 leading-relaxed italic">
                "{sleepScoreDetail.recommendation}"
              </p>
            )}
          </div>
        )}
      </div>

      {/* Forms Section */}
      {showNightForm && (
        <form onSubmit={handleSaveNightSleep} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-slate-800 bg-[#0B0F19]/90 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-[#3A86FF]" />
              {editingNightLog ? 'Edit Night Sleep' : 'Log Night Sleep'}
            </h3>
            <button 
              type="button" 
              onClick={() => { setShowNightForm(false); setEditingNightLog(null); }}
              className="p-1 rounded-full bg-slate-900/40 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">Bedtime</label>
              <input
                type="time"
                value={nightBedtime}
                onChange={(e) => setNightBedtime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">Wake-up Time</label>
              <input
                type="time"
                value={nightWakeup}
                onChange={(e) => setNightWakeup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5 font-bold">Sleep Quality</label>
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl">
              {['1', '2', '3', '4', '5'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNightQuality(r)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    nightQuality === r ? "bg-[#3A86FF] text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex justify-between px-1 mt-1 text-[9px] text-slate-500 font-bold uppercase">
              <span>Very Poor</span>
              <span>Excellent</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">Awakenings (Optional)</label>
            <input
              type="number"
              min="0"
              placeholder="Not Tracked"
              value={nightAwakenings}
              onChange={(e) => setNightAwakenings(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-semibold"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">Notes (Optional)</label>
            <input
              type="text"
              placeholder="Add sleep details or dream records"
              value={nightNotes}
              onChange={(e) => setNightNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200"
            />
          </div>

          {/* Unusually long sleep warning & manual checkbox */}
          {isUnusuallyLong && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
              <div className="flex items-start gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight font-semibold">
                  Unusually long sleep duration calculated ({calcDuration} hours). Please review bedtime and wake-up time.
                </span>
              </div>
              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmLongSleep}
                  onChange={(e) => setConfirmLongSleep(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-[10px] text-slate-300 font-bold select-none uppercase tracking-wide">
                  Confirm this is correct & intentional
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isUnusuallyLong && !confirmLongSleep}
            className="w-full py-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/10"
          >
            Save Nighttime Sleep
          </button>
        </form>
      )}

      {showNapForm && (
        <form onSubmit={handleSaveNap} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-slate-800 bg-[#0B0F19]/90 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-[#02C39A]" />
              {editingNap ? 'Edit Nap' : 'Log Nap'}
            </h3>
            <button 
              type="button" 
              onClick={() => { setShowNapForm(false); setEditingNap(null); }}
              className="p-1 rounded-full bg-slate-900/40 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">Start Time</label>
              <input
                type="time"
                value={napStart}
                onChange={(e) => setNapStart(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#02C39A] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">End Time</label>
              <input
                type="time"
                value={napEnd}
                onChange={(e) => setNapEnd(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#02C39A] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5 font-bold">Nap Quality</label>
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl">
              {['1', '2', '3', '4', '5'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNapQuality(r)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    napQuality === r ? "bg-[#02C39A] text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Power nap, felt refreshed"
              value={napNotes}
              onChange={(e) => setNapNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#02C39A] focus:outline-none rounded-xl text-xs text-slate-200"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#02C39A] hover:bg-[#02C39A]/95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            Save Nap Log
          </button>
        </form>
      )}

      {/* Main Sleep Status Card */}
      <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider flex items-center gap-1.5">
            <Moon className="w-4.5 h-4.5 text-indigo-400" />
            Last Night's Sleep
          </h3>
          {sleepLog && (
            <div className="flex gap-2">
              <button 
                onClick={() => { setEditingNightLog(sleepLog); setShowNightForm(true); }}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button 
                onClick={handleDeleteNightSleep}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {sleepLog ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-950 rounded-2xl flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold uppercase">Bedtime</span>
                <span className="text-sm font-extrabold text-slate-200 mt-1">
                  {sleepLog.bedtime ? formatMinsToTime(
                    Number(sleepLog.bedtime.split('T')[1].split(':')[0]) * 60 + 
                    Number(sleepLog.bedtime.split('T')[1].split(':')[1])
                  ) : 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold uppercase">Wake-up Time</span>
                <span className="text-sm font-extrabold text-slate-200 mt-1">
                  {sleepLog.waketime ? formatMinsToTime(
                    Number(sleepLog.waketime.split('T')[1].split(':')[0]) * 60 + 
                    Number(sleepLog.waketime.split('T')[1].split(':')[1])
                  ) : 'N/A'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-900 flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase">Duration</span>
                <span className="text-xs font-extrabold text-indigo-400 mt-0.5">{sleepLog.totalHours} hrs</span>
              </div>
              <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-900 flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase">Quality</span>
                <span className="text-xs font-extrabold text-[#4CC9F0] mt-0.5">
                  {sleepLog.qualityRating ? `${sleepLog.qualityRating}/5` : `${Math.round(sleepLog.qualityScore/20)}/5`}
                </span>
              </div>
              <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-900 flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase">Awakenings</span>
                <span className="text-xs font-extrabold text-slate-350 mt-0.5">
                  {sleepLog.awakenings !== undefined ? `${sleepLog.awakenings} times` : 'Not Tracked'}
                </span>
              </div>
            </div>

            {sleepLog.notes && (
              <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                "{sleepLog.notes}"
              </p>
            )}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
            <span className="text-xs text-slate-500 font-medium">No sleep logged for this date.</span>
            <button 
              onClick={() => { setEditingNightLog(null); setShowNightForm(true); }}
              className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-500/20 transition-all cursor-pointer"
            >
              Log Night Sleep
            </button>
          </div>
        )}
      </div>

      {/* Naps List Card */}
      <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-4">
        <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider flex items-center gap-1.5">
          <Coffee className="w-4.5 h-4.5 text-[#02C39A]" />
          Naps Today
        </h3>

        {naps.length > 0 ? (
          <div className="flex flex-col gap-2">
            {naps.map((n) => (
              <div key={n.id} className="p-3 bg-slate-950 rounded-2xl flex items-center justify-between border border-slate-900">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-200">
                      {n.startTime} - {n.endTime}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                      {n.durationMinutes} min
                    </span>
                  </div>
                  {n.notes && <span className="text-[10px] text-slate-500 mt-1 italic">"{n.notes}"</span>}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingNap(n); setShowNapForm(true); }}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => handleDeleteNap(n.id)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 font-medium text-center py-2">No naps recorded today.</span>
        )}
      </div>

      {/* History List */}
      <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Previous Logs</h3>
        <div className="flex flex-col gap-2">
          {recentLogs.map((log) => {
            const hasLegacyPhases = log.deepHours !== undefined || log.lightHours !== undefined;
            return (
              <div key={log.date} className="p-3 bg-slate-950/40 rounded-2xl flex items-center justify-between border border-slate-900/50">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-200">{log.date}</span>
                    {hasLegacyPhases && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                        Estimated / Historical
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold mt-1">
                    Duration: {log.totalHours} hrs | Quality: {log.qualityRating ? `${log.qualityRating}/5` : `${Math.round(log.qualityScore/20)}/5`}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const profile = await db.userProfile.get(1);
                    const sleepTarget = profile?.dailySleepTarget || 8.0;
                    alert(`Daily Sleep Score: ${calculateDailySleepScore(log, sleepTarget).score}/100`);
                  }}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  <Award className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
