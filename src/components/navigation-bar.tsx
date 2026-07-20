'use client';

import React from 'react';
import { Home, BarChart2, MessageSquare, User, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function NavigationBar() {
  const { currentTab, setTab, setShowAddModal } = useAppStore();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, isSpecial: false },
    { id: 'progress', label: 'Progress', icon: BarChart2, isSpecial: false },
    { id: 'add', label: '', icon: Plus, isSpecial: true },
    { id: 'coach', label: 'AI Coach', icon: MessageSquare, isSpecial: false },
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
                className="relative -translate-y-4 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-[#3A86FF] to-[#4CC9F0] text-white shadow-lg shadow-blue-500/20 active:scale-90 transition-transform cursor-pointer border border-[#3A86FF]/30"
                aria-label="Quick Log"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
                <span className="absolute inset-0 rounded-full bg-white opacity-0 active:opacity-10 transition-opacity"></span>
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
                  "text-[10px] mt-1 tracking-wide font-medium transition-colors",
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
