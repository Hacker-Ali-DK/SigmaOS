'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bot, Send, Mic, Lightbulb, User } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore, getLocalDateString } from '@/lib/store';
import { cn } from '@/lib/utils';
import { getStructuredDeenAIContext, formatDeenAIContextForPrompt, type DeenAIContext } from '@/lib/deen/deen-ai-context';

interface Message {
  id: number;
  sender: 'ai' | 'user';
  text: string;
  timestamp: number;
}

export default function CoachView() {
  const { selectedDate, getDailyScoresForDate } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'ai',
      text: "Assalamu Alaikum, Abdullah! I'm here to help you become the best version of yourself. Ask me anything about your wellness logs or habits.",
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Queries for dynamic AI insights
  const sleepLogs = useLiveQuery(() => db.sleep.toArray());
  const waterLog = useLiveQuery(() => db.water.get(selectedDate));
  const mealsLog = useLiveQuery(() => db.meals.where({ date: selectedDate }).toArray());

  const suggestions = [
    "Why was my energy low today?",
    "How can I be more consistent?",
    "I missed Fajr. Help me adjust my day.",
    "Should I workout if I slept late?"
  ];

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    // 1. Add user message
    const userMsg: Message = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // 2. Fetch today's scores and structured Deen context
    const scores = await getDailyScoresForDate(selectedDate);
    const deenContext = await getStructuredDeenAIContext(selectedDate, 7);
    const formattedDeenPrompt = formatDeenAIContextForPrompt(deenContext);

    // 3. Generate smart response offline based on database state
    setTimeout(async () => {
      let responseText = "I have analyzed your metrics, but I need more historical data to provide full insights. Try logging more routines!";

      const cleanQuery = text.toLowerCase();
      
      if (cleanQuery.includes('energy') || cleanQuery.includes('sleep')) {
        const todaySleep = await db.sleep.get(selectedDate);
        const avgHrs = sleepLogs && sleepLogs.length > 0 
          ? (sleepLogs.reduce((sum, s) => sum + s.totalHours, 0) / sleepLogs.length)
          : 8.0;
        
        if (todaySleep && todaySleep.totalHours < avgHrs) {
          const diff = (avgHrs - todaySleep.totalHours).toFixed(1);
          responseText = `Today's sleep duration of ${todaySleep.totalHours} hrs is ${diff} hrs less than your weekly average (${avgHrs.toFixed(1)} hrs). This sleep deficit directly impacts your Wellness score (currently ${scores.wellness.score}%) and energy levels. I recommend avoiding screens after Isha and sleeping 30 mins earlier tonight.`;
        } else {
          responseText = `Your sleep logs look solid (around 7.5 to 8.0 hrs), keeping your Wellness score healthy at ${scores.wellness.score}%. If you are still feeling low energy, check your hydration levels. Dehydration is a common hidden cause of daytime fatigue.`;
        }
      } else if (cleanQuery.includes('fajr') || cleanQuery.includes('missed') || cleanQuery.includes('prayer')) {
        const fajrStats = deenContext.prayerTracking.byPrayer.fajr;
        const coverage = deenContext.prayerTracking.coveragePercent;
        const onTime = deenContext.prayerTracking.onTimeCount;
        const missed = deenContext.prayerTracking.missedCount;
        responseText = `Based on your structured tracking context over the last ${deenContext.dateRange.days} days: Your prayer tracking coverage is ${coverage}% with ${onTime} prayed on time and ${missed} explicitly recorded missed. Fajr: ${fajrStats.onTimeCount}/${fajrStats.applicableCount} on time. Unrecorded expired prayers are kept as untracked. To improve consistency, focus on getting to bed early tonight and setting double alarms located away from your bed.`;
      } else if (cleanQuery.includes('quran') || cleanQuery.includes('recitation')) {
        if (deenContext.quran.status === 'untracked') {
          responseText = `Your Qur'an tracking data is currently unrecorded/untracked. (Note: Untracked data is not treated as zero activity). To start tracking, log your daily recitation minutes in the Habits view!`;
        } else {
          responseText = `Qur'an Recitation Summary: ${deenContext.quran.activeDays}/${deenContext.dateRange.days} active days logged with a total of ${deenContext.quran.totalMinutes} minutes (avg ${deenContext.quran.averageMinutesPerActiveDay} min/active day). Maintaining daily consistency helps strengthen focus.`;
        }
      } else if (cleanQuery.includes('consistent') || cleanQuery.includes('habit') || cleanQuery.includes('deen')) {
        responseText = `Your current alignment scores: Overall (${scores.overallAlignment}%), Wellness (${scores.wellness.score}%), Discipline (${scores.discipline.score}%), and Deen (${scores.deen.score}%). Deen tracking coverage: ${deenContext.prayerTracking.coveragePercent}% (${deenContext.prayerTracking.onTimeCount} on time). Anchor habits to lock in: Sleep on time -> Wake for Fajr -> Hydrate.`;
      } else if (cleanQuery.includes('workout') || cleanQuery.includes('late')) {
        responseText = `If you slept late and missed your target sleep window, skip high-intensity workouts today. Instead, do a light 30-minute recovery walk and prioritize hydration (drink 3.0 liters of water) to let your nervous system rest while preserving your Discipline score (currently ${scores.discipline.score}%).`;
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: responseText,
        timestamp: Date.now()
      }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[85vh] text-slate-100 relative">
      {/* Scrollable Chat Feed Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 no-scrollbar flex flex-col gap-4">
        {/* Banner Insight */}
        <div className="glass-panel rounded-3xl p-5 bg-gradient-to-br from-amber-950/15 via-[#0B0F19] to-slate-950 border border-amber-500/10 flex items-start gap-3.5 relative overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
            <Lightbulb className="w-4.5 h-4.5 fill-amber-500/15" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Today's Insight</span>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              You slept 1.5 hrs less than your average. That's probably why your energy was low. Try sleeping 30 mins earlier tonight.
            </p>
          </div>
        </div>

        {/* Chat Bubbles */}
        <div className="flex flex-col gap-3.5 mt-2">
          {messages.map((msg) => {
            const isAI = msg.sender === 'ai';
            return (
              <div 
                key={msg.id}
                className={cn(
                  "flex items-start gap-3 max-w-[85%] animate-in fade-in duration-200",
                  isAI ? "self-start" : "self-end flex-row-reverse"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border",
                  isAI 
                    ? "bg-blue-500/10 border-blue-900/30 text-[#3A86FF]" 
                    : "bg-slate-900 border-slate-950 text-slate-300"
                )}>
                  {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className={cn(
                  "p-3 rounded-2xl text-xs leading-relaxed",
                  isAI 
                    ? "bg-[#0B0F19]/80 border border-slate-900/60 rounded-tl-none text-slate-200" 
                    : "bg-[#3A86FF] text-white rounded-tr-none shadow-md shadow-blue-500/10"
                )}>
                  {msg.text}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-start gap-3 self-start">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-900/30 text-[#3A86FF] flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-[#0B0F19]/80 border border-slate-900/60 p-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
        </div>

        {/* Suggestion list */}
        {messages.length === 1 && (
          <div className="flex flex-col gap-2 mt-4">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider ml-1">Ask me anything</span>
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="w-full text-left p-3 rounded-xl bg-slate-950 border border-slate-900 hover:border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input controls fixed at bottom */}
      <div className="absolute bottom-2 left-0 right-0 px-4 bg-[#03050C]/90 backdrop-blur-sm py-2">
        <div className="flex items-center gap-2 bg-[#0B0F19] border border-slate-900/80 px-4 py-2.5 rounded-2xl">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(inputText);
            }}
            placeholder="Type your question..."
            className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none placeholder:text-slate-600"
          />
          <button className="p-1 rounded-lg text-slate-600 hover:text-slate-400 transition-colors cursor-pointer">
            <Mic className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleSend(inputText)}
            disabled={!inputText.trim()}
            className="p-1.5 rounded-xl bg-[#3A86FF] hover:bg-[#3A86FF]/95 disabled:bg-slate-850 disabled:text-slate-700 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
