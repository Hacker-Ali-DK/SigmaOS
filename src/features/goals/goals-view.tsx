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
      case 'health': return 'text-[#3A86FF] bg-blue-500/10 border-blue-900/30';
      case 'deen': return 'text-emerald-400 bg-emerald-500/10 border-emerald-900/30';
      case 'habits': return 'text-amber-500 bg-amber-500/10 border-amber-900/30';
      case 'career': return 'text-purple-400 bg-purple-500/10 border-purple-900/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-900/30';
    }
  };

  const renderedList = activeTab === 'active' ? activeGoals : completedGoals;

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              aria-label="Back"
              className="btn-ghost"
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
          className="btn-ghost flex items-center gap-1.5 text-xs font-semibold text-[#3A86FF] hover:text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Goal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950 border border-slate-900/60 p-1 rounded-2xl w-full">
        {(['active', 'completed'] as const).map((tab) => (
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

      {/* Goals list */}
      <div className="flex flex-col gap-3 mt-1">
        {renderedList.length > 0 ? (
          renderedList.map((g) => {
            const percent = Math.min(100, Math.round((g.currentValue / g.targetValue) * 100));
            return (
              <div 
                key={g.id}
                className="card-tertiary p-4 flex flex-col gap-3 bg-gradient-to-br from-[#0B0F19] to-[#111625] relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", getCategoryColor(g.category))}>
                      <Target className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-100">{g.title}</span>
                      <span className="text-micro text-slate-500 font-bold uppercase tracking-wider">
                        {g.category} • {g.unit}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-slate-400">
                    {percent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#3A86FF] to-[#4CC9F0] rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Explicit Reversible Target Adjustment Controls: [ - ] CURRENT VALUE [ + ] */}
                {activeTab === 'active' && (
                  <div className="flex items-center justify-between bg-slate-950/60 border border-slate-900/80 p-2 rounded-xl mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                      <span className="text-micro text-slate-500 font-bold uppercase tracking-wider">Progress:</span>
                      <span className="font-extrabold text-slate-100 text-xs">
                        {g.currentValue} / {g.targetValue} {g.unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5" role="group" aria-label={`Adjust progress for ${g.title}`}>
                      <button
                        type="button"
                        onClick={() => handleDecrement(g.id)}
                        disabled={g.currentValue <= 0}
                        aria-label={`Decrease ${g.title} goal value`}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer select-none",
                          g.currentValue <= 0
                            ? "bg-slate-950 border-slate-900/60 text-slate-700 cursor-not-allowed opacity-40"
                            : "bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700 active:scale-95"
                        )}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span 
                        aria-label={`Current value ${g.currentValue}`}
                        className="min-w-[2.25rem] text-center font-extrabold text-xs text-slate-200 select-none px-1"
                      >
                        {g.currentValue}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleIncrement(g.id)}
                        disabled={g.currentValue >= g.targetValue}
                        aria-label={`Increase ${g.title} goal value`}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer select-none",
                          g.currentValue >= g.targetValue
                            ? "bg-slate-950 border-slate-900/60 text-slate-700 cursor-not-allowed opacity-40"
                            : "bg-[#3A86FF]/10 border-[#3A86FF]/30 text-[#3A86FF] hover:bg-[#3A86FF]/20 hover:border-[#3A86FF]/50 active:scale-95"
                        )}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Action Toolbar */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-900/40">
                  <span className="text-micro text-slate-600 font-semibold">
                    Added {new Date(g.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDelete(g.id)}
                      aria-label={`Delete ${g.title} goal`}
                      className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-900 text-slate-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors flex items-center gap-1 text-micro font-semibold"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                    {activeTab === 'active' && (
                      <button
                        onClick={() => handleComplete(g.id)}
                        aria-label={`Mark ${g.title} goal complete`}
                        className="p-1.5 rounded-lg bg-[#02C39A]/10 border border-[#02C39A]/30 text-[#02C39A] hover:bg-[#02C39A]/20 cursor-pointer transition-colors flex items-center gap-1 text-micro font-bold"
                      >
                        <Check className="w-3 h-3" />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-xs text-slate-600 font-semibold border border-dashed border-slate-900/60 rounded-2xl">
            No goals logged.
          </div>
        )}
      </div>

      {/* Inline Form */}
      {showAddForm && (
        <form onSubmit={handleAddGoal} className="card-tertiary flex flex-col gap-4 animate-in slide-in-from-top duration-300">
          <div>
            <label className="text-label text-slate-400 block mb-2">Goal Title</label>
            <input
              type="text"
              placeholder="e.g. Read 12 Books"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-base"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-label text-slate-400 block mb-2">Target Value</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="input-base font-bold"
              />
            </div>
            <div className="flex-1">
              <label className="text-label text-slate-400 block mb-2">Unit</label>
              <input
                type="text"
                placeholder="e.g. kg, %, Books"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="input-base"
              />
            </div>
          </div>

          <div>
            <label className="text-label text-slate-400 block mb-2">Category</label>
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl">
              {(['health', 'deen', 'habits', 'career'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-micro font-semibold capitalize transition-all cursor-pointer",
                    category === cat ? "bg-[#0B0F19] text-[#3A86FF] shadow-sm" : "text-slate-500 hover:text-slate-300"
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
            className="btn-primary w-full text-xs cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            Save Goal
          </button>
        </form>
      )}

      {/* Decorative Quote Mountain Vector Card */}
      <div className="card-primary bg-gradient-to-br from-[#0B0F19] to-slate-950 flex flex-col gap-4 mt-2 relative overflow-hidden p-5">
        {/* Mountain SVG Vector Background */}
        <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none select-none">
          <svg width="180" height="90" viewBox="0 0 180 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M90 10L170 90H10L90 10Z" fill="url(#mountain-grad)" />
            <path d="M125 40L180 90H70L125 40Z" fill="url(#mountain-grad-dark)" />
            <circle cx="90" cy="10" r="4" fill="#3A86FF" className="animate-pulse" />
            <defs>
              <linearGradient id="mountain-grad" x1="90" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
                <stop stop-color="#3A86FF" />
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
          <span className="text-micro text-[#3A86FF] font-bold mt-0.5">Freedom tomorrow.</span>
        </div>
      </div>
    </div>
  );
}
