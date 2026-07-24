'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Sparkles, Calendar, Activity, Moon, Shield } from 'lucide-react';

import { dayBoundaryManager } from '@/lib/day-boundary-manager';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized, showOnboarding, initializeDb, completeOnboarding } = useAppStore();
  const [swRegistered, setSwRegistered] = useState(false);

  // Onboarding local state
  const [name, setName] = useState('Abdullah');
  const [age, setAge] = useState('23');
  const [currentWeight, setCurrentWeight] = useState('69');
  const [targetWeight, setTargetWeight] = useState('75');
  const [cleanStreak, setCleanStreak] = useState('0');
  const [sleepTarget, setSleepTarget] = useState('8.0');

  useEffect(() => {
    // 1. Initialize IndexedDB & Day Boundary Monitor
    initializeDb();
    dayBoundaryManager.init();

    // 2. Register Service Worker for offline PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
            setSwRegistered(true);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
  }, [initializeDb]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    completeOnboarding({
      name,
      age: parseInt(age) || 23,
      currentWeight: parseFloat(currentWeight) || 69,
      targetWeight: parseFloat(targetWeight) || 75,
      cleanStreak: parseInt(cleanStreak) || 0,
      sleepTarget: parseFloat(sleepTarget) || 8.0
    });
  };

  // Render Loader Splash if DB is boot loading
  if (!isInitialized) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#03050C] text-white">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#0B132B] to-[#1C2541] border border-slate-800 flex items-center justify-center shadow-2xl animate-pulse">
            <svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M256 140V372M140 256H372" stroke="#4CC9F0" strokeWidth="48" strokeLinecap="round" className="opacity-90"/>
            </svg>
          </div>
          <div className="absolute top-0 right-0 w-3 h-3 rounded-full bg-[#4CC9F0] blur-sm animate-ping"></div>
        </div>
        <h1 className="text-2xl font-bold tracking-wider font-heading bg-gradient-to-r from-white via-slate-300 to-[#3A86FF] bg-clip-text text-transparent animate-pulse">
          Recovery+
        </h1>
        <p className="text-xs text-slate-500 mt-2 tracking-widest uppercase">
          AI Life Companion
        </p>
        <div className="w-20 h-[2px] bg-slate-800 rounded-full mt-6 overflow-hidden">
          <div className="w-1/2 h-full bg-gradient-to-r from-[#3A86FF] to-[#4CC9F0] rounded-full animate-[loading_1.5s_infinite_ease-in-out]"></div>
        </div>
        
        <style jsx global>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  // Render Onboarding Screen if profile is missing
  if (showOnboarding) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-start bg-[#03050C] text-white px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-md mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-900/30 flex items-center justify-center text-[#3A86FF] mb-3">
              <Sparkles className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold font-heading text-slate-100">Setup Your Profile</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Welcome to Recovery+! Let's tailor the dashboards, targets, and goals to your metrics.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="glass-panel p-5 rounded-3xl border border-slate-900 bg-gradient-to-br from-[#0B0F19] to-slate-950 flex flex-col gap-4 shadow-xl">
            {/* Name & Age */}
            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200"
                />
              </div>
              <div className="flex-[1]">
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">Age</label>
                <input
                  type="number"
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200"
                />
              </div>
            </div>

            {/* Weights */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">Current Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">Target Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
                />
              </div>
            </div>

            {/* Clean Streak starting input */}
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#02C39A]" />
                Current Clean Streak (Days)
              </label>
              <input
                type="number"
                required
                value={cleanStreak}
                onChange={(e) => setCleanStreak(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
                placeholder="e.g. 0 if starting today"
              />
            </div>

            {/* Sleep target hours */}
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-purple-400" />
                Daily Sleep Target (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={sleepTarget}
                onChange={(e) => setSleepTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-900 focus:border-[#3A86FF] focus:outline-none rounded-xl text-xs text-slate-200 font-bold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#3A86FF] hover:bg-[#3A86FF]/95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer mt-2"
            >
              Start Journey
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
