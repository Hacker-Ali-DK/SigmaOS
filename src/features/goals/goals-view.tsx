'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Target, Plus, Check, Trash2, X } from 'lucide-react';
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
      targetValue: parseFloat(targetValue) || 10,
      currentValue: parseFloat(currentValue) || 0,
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

  const handleIncrement = async (goal: Goal) => {
    if (!goal.id) return;
    const nextVal = Math.min(goal.targetValue, goal.currentValue + 1);
    const isComp = nextVal >= goal.targetValue;
    await db.goals.update(goal.id, { 
      currentValue: nextVal,
      completed: isComp
    });
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
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
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
          className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-[#3A86FF] hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold"
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
                className="glass-panel rounded-2xl p-4 flex flex-col gap-3 bg-gradient-to-br from-[#0B0F19] to-[#111625] border border-slate-900/60 group relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", getCategoryColor(g.category))}>
                      <Target className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-100">{g.title}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {g.currentValue} / {g.targetValue} {g.unit}
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

                {/* Actions button */}
                {activeTab === 'active' && (
                  <div className="flex items-center justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-900 text-slate-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleIncrement(g)}
                      className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-900 text-slate-400 hover:text-[#3A86FF] hover:border-slate-800 cursor-pointer transition-colors flex items-center gap-1 text-[10px] font-bold"
                    >
                      <Plus className="w-3 h-3" />
                      Progress
                    </button>
                    <button
                      onClick={() => handleComplete(g.id)}
                      className="p-1.5 rounded-lg bg-slate-950/40 border border-[#02C39A]/20 text-[#02C39A] hover:bg-[#02C39A]/10 cursor-pointer transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
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
        <form onSubmit={handleAddGoal} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-slate-800/50 bg-[#0B0F19]/80 animate-in slide-in-from-top duration-300">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Goal Title</label>
            <input
              type="text"
              placeholder="e.g. Read 12 Books"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Target Value</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Unit</label>
              <input
                type="text"
                placeholder="e.g. kg, %, Books"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200"
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
            className="w-full py-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Save Goal
          </button>
        </form>
      )}

      {/* Decorative Quote Mountain Vector Card */}
      <div className="glass-panel rounded-3xl p-5 bg-gradient-to-br from-[#0B0F19] to-slate-950 border border-slate-900/60 flex flex-col gap-4 mt-2 relative overflow-hidden">
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
          <span className="text-[10px] text-[#3A86FF] font-bold mt-0.5">Freedom tomorrow.</span>
        </div>
      </div>
    </div>
  );
}
