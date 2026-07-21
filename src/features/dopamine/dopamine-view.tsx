'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Shield, AlertTriangle, Calendar, Plus, ChevronDown, Check, Trash2 } from 'lucide-react';
import { db, type DopamineUrge } from '@/lib/db';
import { cn } from '@/lib/utils';

interface DopamineViewProps {
  onBack: () => void;
}

export default function DopamineView({ onBack }: DopamineViewProps) {
  // Queries
  const profile = useLiveQuery(() => db.userProfile.get(1));
  const urges = useLiveQuery(() => 
    db.dopamineUrges.orderBy('timestamp').reverse().toArray()
  );

  // New Urge Input State
  const [showAddForm, setShowAddForm] = useState(false);
  const [strength, setStrength] = useState<'low' | 'medium' | 'high'>('low');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [resisted, setResisted] = useState<'yes' | 'no'>('yes');

  const triggersList = ['Social Media', 'Loneliness', 'Stress', 'Boredom', 'Late Night', 'Fatigue'];

  const toggleTrigger = (trigger: string) => {
    setSelectedTriggers(prev =>
      prev.includes(trigger) ? prev.filter(t => t !== trigger) : [...prev, trigger]
    );
  };

  const handleAddUrge = async (e: React.FormEvent) => {
    e.preventDefault();
    const isResisted = resisted === 'yes';
    
    await db.dopamineUrges.add({
      timestamp: Date.now(),
      strength,
      triggers: selectedTriggers,
      notes: notes.trim() || undefined,
      resisted: isResisted
    });

    if (!isResisted) {
      await db.userProfile.update(1, { cleanStreak: 0 });
    }
    
    // Reset form
    setStrength('low');
    setSelectedTriggers([]);
    setNotes('');
    setResisted('yes');
    setShowAddForm(false);
  };

  const handleDeleteUrge = async (id?: number) => {
    if (!id) return;
    await db.dopamineUrges.delete(id);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Derive counts and metrics
  const getStartAndEndOfToday = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return [start.getTime(), end.getTime()];
  };

  const [startToday, endToday] = getStartAndEndOfToday();

  const dailyUrges = urges 
    ? urges.filter(u => u.timestamp >= startToday && u.timestamp <= endToday)
    : [];

  const urgesTodayCount = dailyUrges.length;
  const resistedTodayCount = dailyUrges.filter(u => u.resisted === true).length;
  const relapsesTodayCount = dailyUrges.filter(u => u.resisted === false).length;
  const validDailyUrges = dailyUrges.filter(u => u.resisted !== undefined && u.resisted !== null);

  const selfControlScoreText = validDailyUrges.length > 0 
    ? `${Math.round((resistedTodayCount / (resistedTodayCount + relapsesTodayCount)) * 100)}%`
    : 'Not Tracked';

  // Aggregate triggers count
  const triggersMap: Record<string, number> = {};
  urges?.forEach(u => {
    u.triggers.forEach(t => {
      triggersMap[t] = (triggersMap[t] || 0) + 1;
    });
  });
  const topTriggers = Object.entries(triggersMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(entry => entry[0])
    .join(', ') || 'None';

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
            Dopamine Recovery
          </h1>
        </div>
        <button 
          onClick={() => setShowAddForm(prev => !prev)}
          className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 text-[#3A86FF]" />
          Log Urge
        </button>
      </div>

      {/* Clean Shield Badge */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-950/20 via-[#0B0F19] to-slate-950 border border-emerald-500/10 shadow-lg text-center relative overflow-hidden py-8">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#02C39A] mb-4 relative shadow-2xl">
          <Shield className="w-10 h-10 fill-emerald-500/10 stroke-[1.5]" />
          <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-md"></div>
        </div>
        <h2 className="text-3xl font-extrabold text-white font-heading tracking-tight">{profile?.cleanStreak ?? 0} Days</h2>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Clean Days Streak</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-3 rounded-2xl flex flex-col justify-between min-h-[64px]">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Urges Today</span>
          <div className="flex items-baseline justify-between mt-1 font-heading">
            <span className="text-sm font-extrabold text-slate-200">{urgesTodayCount}</span>
            <span className="text-[8px] text-slate-500 font-bold">Total Logged</span>
          </div>
        </div>

        <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-3 rounded-2xl flex flex-col justify-between min-h-[64px]">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Self-Control Score</span>
          <div className="flex items-baseline justify-between mt-1 font-heading">
            <span className="text-sm font-extrabold text-[#3A86FF]">{selfControlScoreText}</span>
            <span className="text-[8px] text-slate-500 font-bold">Resisted / Total</span>
          </div>
        </div>

        <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-3 rounded-2xl flex flex-col justify-between min-h-[64px]">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Resisted / Relapsed</span>
          <div className="flex items-baseline justify-between mt-1 font-heading">
            <span className="text-sm font-extrabold text-[#02C39A]">
              {resistedTodayCount} <span className="text-xs font-normal text-slate-500">/</span> <span className="text-rose-500">{relapsesTodayCount}</span>
            </span>
            <span className="text-[8px] text-slate-550 font-bold">Outcome counts</span>
          </div>
        </div>

        <div className="bg-[#0B0F19]/60 border border-slate-900/60 p-3 rounded-2xl flex flex-col justify-between min-h-[64px]">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Top Triggers</span>
          <div className="flex items-baseline justify-between mt-1 font-heading">
            <span className="text-xs font-bold text-slate-300 truncate max-w-[100px]">{topTriggers}</span>
            <span className="text-[8px] text-slate-550 font-bold">Awareness</span>
          </div>
        </div>
      </div>

      {/* Logging Form Panel */}
      {showAddForm && (
        <form onSubmit={handleAddUrge} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-slate-800/50 bg-[#0B0F19]/80 animate-in slide-in-from-top duration-300">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Urge Strength</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStrength(s)}
                  className={cn(
                    "flex-1 py-2 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer",
                    strength === s
                      ? s === 'low' ? 'bg-[#02C39A] border-[#02C39A] text-white'
                        : s === 'medium' ? 'bg-[#FFB703] border-[#FFB703] text-black'
                        : 'bg-[#E63946] border-[#E63946] text-white'
                      : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Select Active Triggers</label>
            <div className="flex flex-wrap gap-1.5">
              {triggersList.map((t) => {
                const active = selectedTriggers.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTrigger(t)}
                    className={cn(
                      "px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-all cursor-pointer",
                      active
                        ? "bg-[#3A86FF]/15 border-[#3A86FF] text-[#3A86FF]"
                        : "bg-slate-950 border-slate-900 text-slate-500 hover:border-slate-800"
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Outcome</label>
            <div className="flex gap-2">
              <button
                key="yes"
                type="button"
                onClick={() => setResisted('yes')}
                className={cn(
                  "flex-1 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                  resisted === 'yes'
                    ? 'bg-[#02C39A]/15 border-[#02C39A] text-[#02C39A]'
                    : 'bg-slate-950 border-slate-900 text-slate-450 hover:border-slate-800'
                )}
              >
                Yes, Resisted Urge
              </button>
              <button
                key="no"
                type="button"
                onClick={() => setResisted('no')}
                className={cn(
                  "flex-1 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                  resisted === 'no'
                    ? 'bg-[#E63946]/15 border-[#E63946] text-[#E63946]'
                    : 'bg-slate-950 border-slate-900 text-slate-450 hover:border-slate-800'
                )}
              >
                No, Relapsed
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Felt triggers while browsing Instagram."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 placeholder:text-slate-700"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
          >
            Save Urge Log
          </button>
        </form>
      )}

      {/* Urge Log Timeline */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Urge Log</h3>
          <span className="text-[10px] text-slate-500 font-bold hover:underline cursor-pointer">View All</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {urges && urges.length > 0 ? (
            urges.map((log) => (
              <div 
                key={log.id} 
                className="bg-[#0B0F19]/45 border border-slate-900/60 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    log.strength === 'low' && "bg-[#02C39A]",
                    log.strength === 'medium' && "bg-[#FFB703]",
                    log.strength === 'high' && "bg-[#E63946]"
                  )} />
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-200 capitalize">
                        {log.strength} Urge
                      </span>
                      <span className="text-[8px] bg-slate-900 border border-slate-950 text-slate-500 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {log.triggers.slice(0, 2).join(', ') || 'No Trigger'}
                      </span>
                      <span className={cn(
                        "text-[8px] border px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                        log.resisted === true ? "bg-emerald-950/20 border-emerald-900/30 text-[#02C39A]" :
                        log.resisted === false ? "bg-rose-950/20 border-rose-900/30 text-rose-400" :
                        "bg-slate-950 border-slate-900 text-slate-500"
                      )}>
                        {log.resisted === true ? 'Resisted' : log.resisted === false ? 'Relapsed' : 'Unknown'}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-semibold">
                      {formatDate(log.timestamp)} {log.notes && `• "${log.notes}"`}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => handleDeleteUrge(log.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-900/40 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-950 flex items-center justify-center cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-slate-600 font-semibold border border-dashed border-slate-900/60 rounded-2xl">
              No urges logged yet. Stay strong!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
