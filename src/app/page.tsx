'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import NavigationBar from '@/components/navigation-bar';
import QuickAddModal from '@/components/quick-add-modal';
import DashboardView from '@/features/dashboard/dashboard-view';
import ScheduleView from '@/features/schedule/schedule-view';
import HabitsView from '@/features/habits/habits-view';
import DopamineView from '@/features/dopamine/dopamine-view';
import NutritionView from '@/features/health/nutrition-view';
import SleepView from '@/features/health/sleep-view';
import AnalyticsView from '@/features/analytics/analytics-view';
import GoalsView from '@/features/goals/goals-view';
import ProfileView from '@/features/profile/profile-view';

export default function AppShell() {
  const { currentTab } = useAppStore();
  const [homeSubView, setHomeSubView] = useState<'dashboard' | 'schedule' | 'habits' | 'dopamine' | 'nutrition' | 'sleep' | 'goals'>('dashboard');

  const [showSplash, setShowSplash] = useState(true);

  // Reset to dashboard if we switch main tabs
  useEffect(() => {
    setHomeSubView('dashboard');
  }, [currentTab]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <main className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center z-[999] select-none bg-[url('/images/dashboard-hero.png')] bg-cover bg-center bg-blend-overlay bg-black/90">
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-1000">
          <img src="/icon-512.png" alt="Sigma Ruler Logo" className="w-24 h-24 mb-6 opacity-90 drop-shadow-[0_0_15px_rgba(215,184,140,0.2)]" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#D7B88C] font-heading tracking-[0.25em]">
            SIGMA RULER
          </h1>
          <p className="mt-3 text-[9px] font-medium text-slate-400 tracking-[0.3em] uppercase">
            Discipline • Recovery • Self-Mastery
          </p>
        </div>
        <div className="absolute bottom-16 flex flex-col items-center w-full px-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
          <span className="text-[8px] text-[#D7B88C] uppercase tracking-widest mb-4 opacity-50 font-semibold">Loading Recovery+</span>
          <div className="w-32 h-[1px] bg-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 left-0 h-full w-full bg-[#D7B88C] animate-pulse origin-left opacity-70"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex-1 min-h-screen bg-[#0A0A0A] text-slate-100 pb-20 select-none">
      {/* Dynamic Screen Area */}
      <div className="w-full max-w-md mx-auto min-h-[80vh]">
        {currentTab === 'home' && (
          <>
            {homeSubView === 'dashboard' && (
              <DashboardView 
                onNavigateToSchedule={() => setHomeSubView('schedule')}
                onNavigateToHabits={() => setHomeSubView('habits')}
                onNavigateToDopamine={() => setHomeSubView('dopamine')}
                onNavigateToSleep={() => setHomeSubView('sleep')}
                onNavigateToNutrition={() => setHomeSubView('nutrition')}
                onNavigateToGoals={() => setHomeSubView('goals')}
              />
            )}
            {homeSubView === 'schedule' && (
              <ScheduleView onBack={() => setHomeSubView('dashboard')} />
            )}
            {homeSubView === 'habits' && (
              <HabitsView 
                onBack={() => setHomeSubView('dashboard')}
                onNavigateToDopamine={() => setHomeSubView('dopamine')}
              />
            )}
            {homeSubView === 'dopamine' && (
              <DopamineView onBack={() => setHomeSubView('dashboard')} />
            )}
            {homeSubView === 'nutrition' && (
              <NutritionView onBack={() => setHomeSubView('dashboard')} />
            )}
            {homeSubView === 'sleep' && (
              <SleepView onBack={() => setHomeSubView('dashboard')} />
            )}
            {homeSubView === 'goals' && (
              <GoalsView onBack={() => setHomeSubView('dashboard')} />
            )}
          </>
        )}
        {currentTab === 'progress' && <AnalyticsView />}
        {currentTab === 'profile' && <ProfileView />}
      </div>

      {/* Global Navigation controls */}
      <NavigationBar />
      
      {/* Drawer Overlay for logging metrics */}
      <QuickAddModal />
    </main>
  );
}
