'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Calendar, ChevronRight, Check, Circle, ChevronLeft, ChevronRight as ChevronRightIcon, ArrowLeft } from 'lucide-react';
import { db, type RoutineTask } from '@/lib/db';
import { useAppStore, getLocalDateString } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ScheduleViewProps {
  onBack?: () => void;
}

export default function ScheduleView({ onBack }: ScheduleViewProps) {
  const { selectedDate, setSelectedDate } = useAppStore();
  const [activeTab, setActiveTab] = useState<'schedule' | 'timeline'>('schedule');

  // Query routines for selectedDate
  const routines = useLiveQuery(() => 
    db.routines.where({ date: selectedDate }).sortBy('order')
  );

  // Pagination helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToggleTask = async (task: RoutineTask) => {
    if (!task.id) return;
    const nextCompleted = !task.completed;
    await db.routines.update(task.id, { completed: nextCompleted });

    // Sync back to trackers
    if (task.taskName === 'Fajr' || task.taskName === 'Dhuhr' || task.taskName === 'Asr' || task.taskName === 'Maghrib' || task.taskName === 'Isha') {
      const field = task.taskName.toLowerCase() as 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
      const log = await db.prayers.get(selectedDate);
      if (log) {
        await db.prayers.update(selectedDate, { [field]: nextCompleted });
      }
    } else if (task.taskName === 'Water') {
      await db.water.put({
        date: selectedDate,
        amountLiters: nextCompleted ? 2.4 : 0
      });
    } else if (task.taskName === 'Workout') {
      if (nextCompleted) {
        await db.workouts.put({ date: selectedDate, type: 'Workout', durationMinutes: 30, intensity: 'medium' });
      } else {
        await db.workouts.where({ date: selectedDate }).delete();
      }
    } else if (task.taskName === 'Sleep') {
      if (nextCompleted) {
        await db.sleep.put({
          date: selectedDate,
          totalHours: 7.5,
          deepHours: 2.1,
          lightHours: 4.2,
          remHours: 1.2,
          awakeHours: 0.3,
          qualityScore: 82
        });
      } else {
        await db.sleep.where({ date: selectedDate }).delete();
      }
    }
  };

  // Format date display (e.g. Friday, 17 May 2024)
  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const isTodaySelected = selectedDate === getLocalDateString();

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      {/* Date Header with Pagination */}
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
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
              {isTodaySelected ? 'Today' : 'Timeline Date'}
            </span>
            <h1 className="text-lg font-bold text-slate-200 font-heading tracking-wide">
              {formatDateLabel(selectedDate)}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={handlePrevDay}
            className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={handleNextDay}
            className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center justify-center text-slate-400 cursor-pointer">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Schedule / Timeline sliding pill tabs */}
      <div className="flex bg-slate-950 border border-slate-900/60 p-1 rounded-2xl w-full">
        {(['schedule', 'timeline'] as const).map((tab) => (
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

      {/* Routine Timeline */}
      <div className="relative mt-4 pl-4">
        {/* Vertical Timeline Track Line */}
        <div className="absolute left-[23px] top-4 bottom-4 w-[2px] bg-slate-900/60" />

        <div className="flex flex-col gap-6">
          {routines?.map((task) => {
            const isCompleted = task.completed;
            const isPrayer = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(task.taskName);
            
            let statusText = isCompleted ? 'Completed' : 'Pending';
            if (isPrayer && isCompleted) statusText = 'Prayed';

            return (
              <div 
                key={task.id}
                className="relative flex items-center justify-between pl-8 group"
              >
                {/* Timeline axis indicator node */}
                <button
                  onClick={() => handleToggleTask(task)}
                  className={cn(
                    "absolute left-[14px] w-5 h-5 rounded-full flex items-center justify-center border z-10 transition-all cursor-pointer active:scale-90",
                    isCompleted
                      ? "bg-[#02C39A] border-[#02C39A] text-slate-950 scale-105"
                      : "bg-[#0B0F19] border-slate-800 text-slate-600 hover:border-slate-700"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                  ) : (
                    <Circle className="w-1.5 h-1.5 fill-slate-700 stroke-none" />
                  )}
                </button>

                {/* Event Info Panel */}
                <div 
                  onClick={() => handleToggleTask(task)}
                  className={cn(
                    "flex-1 flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer",
                    isCompleted
                      ? "bg-[#0B0F19]/45 border-[#3A86FF]/10 text-slate-200"
                      : "bg-[#0B0F19]/80 border-slate-900/70 hover:border-slate-800 text-slate-400"
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className={cn(
                      "text-xs font-bold font-heading",
                      isCompleted ? "text-slate-100" : "text-slate-400"
                    )}>
                      {task.taskName}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      {task.timeLabel} • <span className={cn(isCompleted ? "text-[#02C39A]" : "text-slate-500")}>{statusText}</span>
                    </span>
                  </div>

                  <div className="flex items-center text-slate-600 group-hover:text-slate-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
