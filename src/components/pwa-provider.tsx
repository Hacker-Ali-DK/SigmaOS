'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Sparkles, Calendar, Activity, Moon, Shield } from 'lucide-react';

import { dayBoundaryManager } from '@/lib/day-boundary-manager';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized, showOnboarding, initializeDb, completeOnboarding } = useAppStore();
  const [swRegistered, setSwRegistered] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Onboarding local state
  const [name, setName] = useState('Abdullah');
  const [age, setAge] = useState('23');
  const [currentWeight, setCurrentWeight] = useState('69');
  const [targetWeight, setTargetWeight] = useState('75');
  const [cleanStreak, setCleanStreak] = useState('0');
  const [sleepTarget, setSleepTarget] = useState('8.0');

  useEffect(() => {
    // 1. Initialize IndexedDB & Day Boundary Monitor sequentially
    const initApp = async () => {
      await initializeDb();
      dayBoundaryManager.init();
    };
    initApp().catch(console.error);

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
  if (!isInitialized || showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#03050C] animate-in fade-in duration-500 overflow-hidden">
        {/* Subtle atmospheric glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(58,134,255,0.08)_0%,rgba(3,5,12,0)_60%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center flex-1 justify-center w-full max-w-md mx-auto -mt-10">
          {/* Dragon Emblem */}
          <div className="w-56 h-56 relative flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
            {/* Subtle glow behind the dragon */}
            <div className="absolute inset-0 bg-[#3A86FF]/20 blur-[50px] rounded-full scale-50" />
            <img 
              src="/images/blue-dragon-icon.png" 
              alt="RULER Dragon" 
              className="w-full h-full object-contain scale-[1.7] relative z-10 drop-shadow-[0_0_12px_rgba(58,134,255,0.3)]"
            />
          </div>

          {/* Branding Typography */}
          <div className="flex flex-col items-center mt-4">
            <h1 className="text-4xl font-black font-heading tracking-[0.25em] text-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-[400ms] fill-mode-both drop-shadow-md">
              RULER
            </h1>
            <h2 className="text-[9px] font-bold tracking-[0.4em] text-slate-400 mt-3 uppercase animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-[700ms] fill-mode-both">
              Personal Mastery System
            </h2>
          </div>
        </div>

        {/* Loading Indicator */}
        <div className="absolute bottom-16 w-full max-w-xs mx-auto flex flex-col items-center gap-3 animate-in fade-in duration-1000 delay-[1000ms] fill-mode-both">
          <span className="text-[9px] font-bold tracking-widest text-[#3A86FF] uppercase">
            Initializing...
          </span>
          <div className="w-full h-0.5 bg-slate-900 rounded-full overflow-hidden shadow-inner relative">
            <div className="absolute top-0 left-0 h-full bg-[#3A86FF] rounded-full shadow-[0_0_10px_rgba(58,134,255,0.8)] progress-bar-fill" />
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes load-progress {
            0% { width: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { width: 90%; opacity: 1; }
            100% { width: 100%; opacity: 0; }
          }
          .progress-bar-fill {
            animation: load-progress 2.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
          }
        `}} />
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
