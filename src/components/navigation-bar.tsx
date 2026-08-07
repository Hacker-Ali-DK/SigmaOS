'use client';

import React from 'react';
import { Home, BarChart2, User, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function NavigationBar() {
  const { currentTab, setTab, setShowAddModal } = useAppStore();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, isSpecial: false },
    { id: 'progress', label: 'Progress', icon: BarChart2, isSpecial: false },
    { id: 'add', label: '', icon: null, isSpecial: true },
    { id: 'profile', label: 'Profile', icon: User, isSpecial: false },
  ] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/90 backdrop-blur-lg border-t border-slate-900/50 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          
          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                onClick={() => setShowAddModal(true)}
                className="relative -translate-y-4 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-b from-[#1C2541] to-[#0B0F19] shadow-[0_0_15px_rgba(58,134,255,0.15)] active:scale-90 transition-all cursor-pointer border border-[#3A86FF]/30 hover:border-[#3A86FF]/60 hover:shadow-[0_0_20px_rgba(58,134,255,0.3)] hover:scale-105 group p-[2px]"
                aria-label="Quick Log"
              >
                <div className="relative w-full h-full rounded-full overflow-hidden bg-[#0B0F19] flex items-center justify-center shadow-inner">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#3A86FF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                  <img 
                    src="/images/blue-dragon-icon.png" 
                    alt="Dragon" 
                    className="w-full h-full object-contain scale-[1.8] opacity-90 group-hover:opacity-100 transition-transform relative z-0" 
                  />
                </div>
                <span className="absolute inset-0 rounded-full bg-white opacity-0 active:opacity-10 transition-opacity pointer-events-none z-20"></span>
              </button>
            );
          }

          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center cursor-pointer transition-colors"
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  isActive ? "text-[#3A86FF] scale-110" : "text-slate-500 hover:text-slate-300"
                )}
              />
              <span
                className={cn(
                  "text-micro mt-1 tracking-wide font-medium transition-colors",
                  isActive ? "text-[#3A86FF]" : "text-slate-500"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
