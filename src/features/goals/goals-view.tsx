'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Target, Plus, Minus, Check, Trash2 } from 'lucide-react';
import { db, type Goal } from '@/lib/db';
import { cn } from '@/lib/utils';

interface GoalsViewProps {
  onBack?: () => void;
}

export default function GoalsView({ onBack }: GoalsViewProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('10');
  const [currentValue, setCurrentValue] = useState('0');
  const [unit, setUnit] = useState('%');
  const [category, setCategory] = useState<'health' | 'deen' | 'habits' | 'career'>('health');

  // Query goals
  const goals = useLiveQuery(() => 
    db.goals.toArray()
  );

  const activeGoals = goals?.filter(g => !g.completed) || [];
  const completedGoals = goals?.filter(g => g.completed) || [];

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await db.goals.add({
      title: title.trim(),
      targetValue: Math.max(1, parseFloat(targetValue) || 10),
      currentValue: Math.max(0, parseFloat(currentValue) || 0),
      unit: unit.trim() || '%',
      category,
      completed: false,
      createdAt: Date.now()
    });

    setTitle('');
    setTargetValue('10');
    setCurrentValue('0');
    setUnit('%');
    setShowAddForm(false);
  };

  // Atomic Dexie transaction for rapid tap concurrency safety
  const adjustGoalValue = async (id: number, delta: number) => {
    if (!id) return;
    await db.transaction('rw', db.goals, async () => {
      const latest = await db.goals.get(id);
      if (!latest) return;

      const minVal = 0;
      const maxVal = Math.max(latest.targetValue, 0);
      const nextVal = Math.max(minVal, Math.min(maxVal, latest.currentValue + delta));
      const isComp = nextVal >= latest.targetValue && latest.targetValue > 0;

      await db.goals.update(id, { 
        currentValue: nextVal,
        completed: isComp
      });
    });
  };

  const handleIncrement = (id?: number) => {
    if (id) adjustGoalValue(id, 1);
  };

  const handleDecrement = (id?: number) => {
    if (id) adjustGoalValue(id, -1);
  };

  const handleComplete = async (id?: number) => {
    if (!id) return;
    await db.goals.update(id, { completed: true });
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    await db.goals.delete(id);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'health': return 'text-[#D7B88C] bg-blue-500/10 border-blue-900/30';
      case 'deen': return 'text-emerald-400 bg-emerald-500/10 border-emerald-900/30';
      case 'habits': return 'text-amber-500 bg-amber-500/10 border-amber-900/30';
      case 'career': return 'text-purple-400 bg-purple-500/10 border-purple-900/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-900/30';
    }
  };

  const renderedList = activeTab === 'active' ? activeGoals : completedGoals;

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              aria-label="Back"
              className="p-2 rounded-xl bg-[#1E2328]/40 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-lg font-bold text-slate-200 font-heading tracking-wide">
            Goals
          </h1>
        </div>
        <button 
          onClick={() => setShowAddForm(prev => !prev)}
          aria-label="Add new goal"
          className="p-2 rounded-xl bg-[#1E2328]/40 border border-slate-800 text-[#D7B88C] hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Goal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#1E2328] rounded-xl p-1 w-full shadow-lg shadow-black/20 mt-2">
        {(['active', 'completed'] as const).map((tab) => (
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

      {/* Goals list */}
      <div className="flex flex-col gap-4 mt-4">
        {renderedList.length > 0 ? (
          renderedList.map((g) => {
            const percent = Math.min(100, Math.round((g.currentValue / g.targetValue) * 100));
            return (
              <div 
                key={g.id}
                className="rounded-3xl p-5 flex flex-col gap-4 bg-[#0A0A0A] border border-[#1E2328] shadow-lg relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center border shadow-sm", getCategoryColor(g.category))}>
                      <Target className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-extrabold text-slate-200">{g.title}</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        {g.category} • {g.unit}
                      </span>
                    </div>
                  </div>
                  <span className="text-xl font-extrabold text-slate-200 font-heading tracking-tight">
                    {percent}<span className="text-[10px] text-slate-500 font-sans ml-0.5">%</span>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-[#1E2328] rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-gradient-to-r from-[#D7B88C] to-[#E5CFA6] rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Explicit Reversible Target Adjustment Controls */}
                {activeTab === 'active' && (
                  <div className="flex items-center justify-between bg-[#1E2328]/30 border border-[#1E2328] p-3 rounded-2xl mt-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Progress</span>
                      <span className="font-extrabold text-slate-200 text-xs font-mono tracking-tight">
                        {g.currentValue} / {g.targetValue} <span className="text-[10px] text-slate-500 ml-0.5">{g.unit}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2" role="group" aria-label={`Adjust progress for ${g.title}`}>
                      <button
                        type="button"
                        onClick={() => handleDecrement(g.id)}
                        disabled={g.currentValue <= 0}
                        aria-label={`Decrease ${g.title} goal value`}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer select-none",
                          g.currentValue <= 0
                            ? "bg-[#0A0A0A] border border-[#1E2328] text-slate-700 cursor-not-allowed"
                            : "bg-[#1E2328] text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 shadow-sm"
                        )}
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <span 
                        aria-label={`Current value ${g.currentValue}`}
                        className="min-w-[2.5rem] text-center font-extrabold text-sm text-slate-200 select-none"
                      >
                        {g.currentValue}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleIncrement(g.id)}
                        disabled={g.currentValue >= g.targetValue}
                        aria-label={`Increase ${g.title} goal value`}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer select-none",
                          g.currentValue >= g.targetValue
                            ? "bg-[#0A0A0A] border border-[#1E2328] text-slate-700 cursor-not-allowed"
                            : "bg-[#D7B88C] text-[#0A0A0A] hover:bg-[#D7B88C]/90 active:scale-95 shadow-md shadow-[#D7B88C]/20"
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Action Toolbar */}
                <div className="flex items-center justify-between pt-3 border-t border-[#1E2328] mt-1">
                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">
                    Added {new Date(g.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(g.id)}
                      aria-label={`Delete ${g.title} goal`}
                      className="p-2 rounded-xl bg-[#0A0A0A] border border-[#1E2328] text-slate-500 hover:text-rose-500 hover:border-rose-500/30 cursor-pointer transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                    {activeTab === 'active' && (
                      <button
                        onClick={() => handleComplete(g.id)}
                        aria-label={`Mark ${g.title} goal complete`}
                        className="p-2 rounded-xl bg-[#02C39A]/10 border border-[#02C39A]/30 text-[#02C39A] hover:bg-[#02C39A]/20 cursor-pointer transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-xs text-slate-500 font-bold uppercase tracking-widest border border-dashed border-[#1E2328] rounded-3xl bg-[#1E2328]/10">
            No goals logged.
          </div>
        )}
      </div>

      {/* Inline Form */}
      {showAddForm && (
        <form onSubmit={handleAddGoal} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 bg-[#0A0A0A] border border-slate-800 animate-in slide-in-from-top duration-300">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Goal Title</label>
            <input
              type="text"
              placeholder="e.g. Read 12 Books"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#0A0A0A] border border-slate-800 focus:border-[#D7B88C] focus:outline-none rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Target Value</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-slate-800 focus:border-[#D7B88C] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Unit</label>
              <input
                type="text"
                placeholder="e.g. kg, %, Books"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-slate-800 focus:border-[#D7B88C] focus:outline-none rounded-xl text-xs text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Category</label>
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl">
              {(['health', 'deen', 'habits', 'career'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all cursor-pointer",
                    category === cat ? "bg-[#0B0F19] text-[#D7B88C] shadow-sm" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full py-3 bg-[#D7B88C] hover:bg-[#D7B88C]/95 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-[#0A0A0A] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Save Goal
          </button>
        </form>
      )}

      {/* Decorative Quote Mountain Vector Card */}
      <div className="glass-panel rounded-3xl p-5 bg-[#0A0A0A] border border-slate-800 flex flex-col gap-4 mt-2 relative overflow-hidden">
        {/* Mountain SVG Vector Background */}
        <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none select-none">
          <svg width="180" height="90" viewBox="0 0 180 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M90 10L170 90H10L90 10Z" fill="url(#mountain-grad)" />
            <path d="M125 40L180 90H70L125 40Z" fill="url(#mountain-grad-dark)" />
            <circle cx="90" cy="10" r="4" fill="#D7B88C" className="animate-pulse" />
            <defs>
              <linearGradient id="mountain-grad" x1="90" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
                <stop stop-color="#D7B88C" />
                <stop offset="1" stop-color="#03050C" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="mountain-grad-dark" x1="125" y1="40" x2="125" y2="90" gradientUnits="userSpaceOnUse">
                <stop stop-color="#4CC9F0" />
                <stop offset="1" stop-color="#03050C" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="flex flex-col max-w-[70%]">
          <span className="text-xs font-extrabold text-slate-100 font-heading leading-snug">Discipline today.</span>
          <span className="text-[10px] text-[#D7B88C] font-bold mt-0.5">Freedom tomorrow.</span>
        </div>
      </div>
    </div>
  );
}
