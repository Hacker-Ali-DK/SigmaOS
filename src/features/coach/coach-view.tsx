'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bot, Send, Mic, Lightbulb, User, TrendingUp, ShieldAlert, Sparkles, Check, X, Info } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { aiOrchestrator, type OrchestratedAIResponse } from '@/lib/ai/orchestrator';
import { memoryManager } from '@/lib/ai/memory-manager';
import type { ChatMessageRecord, AIActionRequest } from '@/lib/ai/types';

export default function CoachView() {
  const { selectedDate } = useAppStore();
  const sessionId = 'primary_session';

  const persistentMessages = useLiveQuery(() => memoryManager.getSessionHistory(sessionId), [sessionId]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState<OrchestratedAIResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<AIActionRequest | null>(null);

  const suggestions = [
    "WHY did my Recovery Score change?",
    "Optimize my daily schedule around Fajr",
    "What is my predicted energy peak today?",
    "WHY is relapse risk low or high?"
  ];

  // Initialize initial welcome turn if message history is empty
  useEffect(() => {
    async function initWelcome() {
      const history = await memoryManager.getSessionHistory(sessionId);
      if (history.length === 0) {
        await memoryManager.addTurn(
          sessionId,
          'ai',
          "Assalamu Alaikum, Abdullah! I am your AI Personal Operating System. I actively predict your energy levels, monitor prayer consistency, and optimize your daily schedule offline."
        );
      }
    }
    initWelcome();
  }, [sessionId]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    setInputText('');
    setIsTyping(true);

    try {
      const result = await aiOrchestrator.processUserMessage(sessionId, text.trim(), selectedDate);
      setLastAIResponse(result);
      if (result.pendingAction) {
        setPendingAction(result.pendingAction);
      }
    } catch (err) {
      console.error("AI Orchestrator Error:", err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionApproval = (approved: boolean) => {
    if (pendingAction) {
      if (approved) {
        memoryManager.addTurn(
          sessionId,
          'ai',
          `✓ Action Approved: ${pendingAction.title} has been applied to your daily routines!`
        );
      } else {
        memoryManager.addTurn(
          sessionId,
          'ai',
          `Action Dismissed: ${pendingAction.title} was not applied.`
        );
      }
      setPendingAction(null);
    }
  };

  return (
    <div className="flex flex-col h-[85vh] text-slate-100 relative">
      {/* Scrollable Chat Feed Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-32 no-scrollbar flex flex-col gap-4">
        
        {/* Real-time Predictive Summary Header */}
        {lastAIResponse?.predictions && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="glass-panel p-3 rounded-2xl bg-slate-900/80 border border-slate-800/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Predicted Recovery</span>
                <span className="text-xs font-semibold text-emerald-400">
                  {lastAIResponse.predictions.recoveryScorePred}% (High Conf)
                </span>
              </div>
            </div>

            <div className="glass-panel p-3 rounded-2xl bg-slate-900/80 border border-slate-800/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Relapse Vulnerability</span>
                <span className="text-xs font-semibold text-blue-400">
                  {lastAIResponse.predictions.relapseRisk}% (Low Risk)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Explainability Feature Attribution Banner */}
        {lastAIResponse?.explanation && (
          <div className="glass-panel rounded-3xl p-4 bg-gradient-to-br from-blue-950/20 via-[#0B0F19] to-slate-950 border border-blue-500/20 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
              <Info className="w-4 h-4" />
              <span>AI Reasoning & Attribution Trace</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lastAIResponse.explanation.userText}
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {lastAIResponse.explanation.auditTrace.attributions.map((attr, idx) => (
                <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                  {attr.feature}: {attr.impactPoints > 0 ? `+${attr.impactPoints}` : attr.impactPoints} pts
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Level 2 Action Permission Confirmation Modal */}
        {pendingAction && (
          <div className="glass-panel rounded-3xl p-4 bg-gradient-to-br from-amber-950/20 via-[#0B0F19] to-slate-950 border border-amber-500/30 flex flex-col gap-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Permission Required: {pendingAction.title}</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                {pendingAction.securityLabel}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {pendingAction.description}
            </p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <button
                onClick={() => handleActionApproval(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
              <button
                onClick={() => handleActionApproval(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Approve Action
              </button>
            </div>
          </div>
        )}

        {/* Chat Bubbles */}
        <div className="flex flex-col gap-3.5 mt-2">
          {(persistentMessages || []).map((msg) => {
            const isAI = msg.sender === 'ai';
            return (
              <div 
                key={msg.id || msg.timestamp}
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
        {(!persistentMessages || persistentMessages.length <= 1) && (
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
            placeholder="Ask AI Personal OS..."
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
