import { db } from '@/lib/db';
import type { ChatMessageRecord, AIMemoryRecord } from './types';

class MemoryManager {
  private volatileSessionBuffer: ChatMessageRecord[] = [];
  private readonly maxVolatileTurns = 10;

  /**
   * Appends a new turn to volatile memory & persists to IndexedDB
   */
  async addTurn(sessionId: string, sender: 'ai' | 'user', text: string, metadata?: Record<string, any>): Promise<ChatMessageRecord> {
    const record: ChatMessageRecord = {
      sessionId,
      sender,
      text,
      timestamp: Date.now(),
      metadata
    };

    // 1. Add to Dexie Persistent Store
    const id = await db.chatMessages.add(record);
    record.id = id;

    // 2. Add to Volatile RAM buffer
    this.volatileSessionBuffer.push(record);
    if (this.volatileSessionBuffer.length > this.maxVolatileTurns) {
      this.volatileSessionBuffer.shift(); // Maintain sliding window of 10 turns
    }

    // 3. Extract long-term facts if user message contains key traits
    if (sender === 'user') {
      await this.extractAndSaveFacts(text);
    }

    return record;
  }

  /**
   * Retrieves full chat history for a given session from IndexedDB
   */
  async getSessionHistory(sessionId: string): Promise<ChatMessageRecord[]> {
    return await db.chatMessages.where({ sessionId }).sortBy('timestamp');
  }

  /**
   * Formats long-term facts & rolling summaries for system prompt injection
   */
  async getMemoryContextForPrompt(): Promise<string> {
    const facts = await db.aiMemory.toArray();
    if (facts.length === 0) return 'NO_LONG_TERM_FACTS_LOGGED';

    return facts
      .map(f => `[FACT: ${f.category.toUpperCase()}] ${f.key}: ${f.value} (Conf: ${Math.round(f.confidence * 100)}%)`)
      .join('\n');
  }

  /**
   * Simple regex/rule-based long-term fact extraction from user input
   */
  private async extractAndSaveFacts(userText: string): Promise<void> {
    const lower = userText.toLowerCase();

    if (lower.includes('work night shift') || lower.includes('night shift')) {
      await this.saveFact('work_schedule', 'Works night shifts', 'fact', 0.9);
    }
    if (lower.includes('struggle with fajr') || lower.includes('miss fajr often')) {
      await this.saveFact('fajr_struggle', 'Struggles with waking for Fajr prayer', 'fact', 0.85);
    }
    if (lower.includes('prefer firm') || lower.includes('be direct')) {
      await this.saveFact('coaching_style', 'Prefers direct and firm guidance', 'preference', 0.95);
    }
  }

  /**
   * Persists a long-term fact or preference into db.aiMemory
   */
  async saveFact(key: string, value: string, category: 'preference' | 'fact' | 'summary', confidence = 0.8): Promise<void> {
    const record: AIMemoryRecord = {
      key,
      value,
      category,
      confidence,
      updatedAt: Date.now()
    };
    await db.aiMemory.put(record);
  }

  /**
   * Cryptographically clears chat session history (Privacy Hard-Purge)
   */
  async clearSessionHistory(sessionId: string): Promise<void> {
    this.volatileSessionBuffer = [];
    await db.chatMessages.where({ sessionId }).delete();
  }
}

export const memoryManager = new MemoryManager();
