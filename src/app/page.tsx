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
import CoachView from '@/features/coach/coach-view';
import ProfileView from '@/features/profile/profile-view';

export default function AppShell() {
  const { currentTab } = useAppStore();
  const [homeSubView, setHomeSubView] = useState<'dashboard' | 'schedule' | 'habits' | 'dopamine' | 'nutrition' | 'sleep' | 'goals'>('dashboard');

  // Reset to dashboard if we switch main tabs
  useEffect(() => {
    setHomeSubView('dashboard');
  }, [currentTab]);

  return (
    <main className="relative flex-1 min-h-screen bg-[#03050C] text-slate-100 pb-20 select-none">
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
        {currentTab === 'coach' && <CoachView />}
        {currentTab === 'profile' && <ProfileView />}
      </div>

      {/* Global Navigation controls */}
      <NavigationBar />
      
      {/* Drawer Overlay for logging metrics */}
      <QuickAddModal />
    </main>
  );
}
