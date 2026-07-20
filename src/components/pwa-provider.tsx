'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized, initializeDb } = useAppStore();
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // 1. Initialize IndexedDB
    initializeDb();

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

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#03050C] text-white">
        <div className="relative flex items-center justify-center mb-6">
          {/* Logo circle background */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#0B132B] to-[#1C2541] border border-slate-800 flex items-center justify-center shadow-2xl animate-pulse">
            <svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M256 140V372M140 256H372" stroke="#4CC9F0" stroke-width="48" stroke-linecap="round" className="opacity-90"/>
            </svg>
          </div>
          {/* Glow points */}
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

  return <>{children}</>;
}
