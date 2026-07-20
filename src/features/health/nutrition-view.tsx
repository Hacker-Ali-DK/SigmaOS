'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Calendar, Plus, Trash2, Utensils } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface NutritionViewProps {
  onBack: () => void;
}

export default function NutritionView({ onBack }: NutritionViewProps) {
  const { selectedDate } = useAppStore();

  // Queries
  const meals = useLiveQuery(() => 
    db.meals.where({ date: selectedDate }).toArray()
  );
  const waterLog = useLiveQuery(() => 
    db.water.get(selectedDate)
  );

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('500');
  const [mealProtein, setMealProtein] = useState('25');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'snack' | 'dinner'>('breakfast');

  // Macros sum
  const totalCalories = meals?.reduce((sum, m) => sum + m.calories, 0) || 0;
  const totalProtein = meals?.reduce((sum, m) => sum + m.proteinGrams, 0) || 0;
  const waterAmt = waterLog?.amountLiters || 0;

  const calTarget = 2500;
  const protTarget = 120;
  const waterTarget = 3.0;

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName.trim()) return;

    await db.meals.add({
      date: selectedDate,
      mealType,
      description: mealName.trim(),
      calories: parseInt(mealCalories) || 0,
      proteinGrams: parseInt(mealProtein) || 0
    });

    // Update today's routines for meals
    const routines = await db.routines.where({ date: selectedDate }).toArray();
    const mealsRoutine = routines.find(r => r.taskName === 'Meals' || r.taskName === 'Lunch');
    if (mealsRoutine?.id) {
      await db.routines.update(mealsRoutine.id, { completed: true });
    }

    setMealName('');
    setShowAddForm(false);
  };

  const handleDeleteMeal = async (id?: number) => {
    if (!id) return;
    await db.meals.delete(id);
  };

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
            Nutrition
          </h1>
        </div>
        <button 
          onClick={() => setShowAddForm(prev => !prev)}
          className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 text-[#3A86FF]" />
          Add Meal
        </button>
      </div>

      {/* Meals List */}
      <div className="flex flex-col gap-2.5">
        {meals && meals.length > 0 ? (
          meals.map((meal) => (
            <div 
              key={meal.id} 
              className="bg-[#0B0F19]/45 border border-slate-900/60 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-800/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Utensils className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-200 capitalize">
                      {meal.mealType}
                    </span>
                    <span className="text-[8px] bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      {meal.calories} kcal
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {meal.description} • <span className="text-slate-500 font-bold">{meal.proteinGrams}g Protein</span>
                  </span>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteMeal(meal.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-900/40 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-950 flex items-center justify-center cursor-pointer transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-xs text-slate-600 font-semibold border border-dashed border-slate-900/60 rounded-2xl">
            No meals logged for today.
          </div>
        )}
      </div>

      {/* Inline form */}
      {showAddForm && (
        <form onSubmit={handleAddMeal} className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-slate-800/50 bg-[#0B0F19]/80 animate-in slide-in-from-top duration-300">
          <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl">
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
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Meal Description</label>
            <input
              type="text"
              placeholder="e.g. Chicken Rice, Salad"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 placeholder:text-slate-700"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Calories (kcal)</label>
              <input
                type="number"
                value={mealCalories}
                onChange={(e) => setMealCalories(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">Protein (g)</label>
              <input
                type="number"
                value={mealProtein}
                onChange={(e) => setMealProtein(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!mealName.trim()}
            className="w-full py-3 bg-[#3A86FF] hover:bg-[#3A86FF]/95 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Save Meal
          </button>
        </form>
      )}

      {/* Target Macros progress bars */}
      <div className="flex flex-col gap-4 bg-[#0B0F19]/60 border border-slate-900/60 p-5 rounded-3xl mt-2">
        <h3 className="text-xs font-bold text-slate-200 font-heading uppercase tracking-wider">Macro Targets</h3>

        {/* Calories Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-semibold">
            <span>Total Calories</span>
            <span className="text-slate-200">{totalCalories} / {calTarget} kcal</span>
          </div>
          <div className="w-full h-2 bg-slate-950/60 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#3A86FF] to-[#4CC9F0] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalCalories / calTarget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Protein Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-semibold">
            <span>Protein</span>
            <span className="text-[#02C39A]">{totalProtein} / {protTarget} g</span>
          </div>
          <div className="w-full h-2 bg-slate-950/60 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#02C39A] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalProtein / protTarget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Water Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-semibold">
            <span>Water Intake</span>
            <span className="text-cyan-400">{waterAmt} / {waterTarget} L</span>
          </div>
          <div className="w-full h-2 bg-slate-950/60 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (waterAmt / waterTarget) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
