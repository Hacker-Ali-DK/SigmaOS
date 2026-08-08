# AI Specification

## 1. Current Architecture Overview
Recovery+ contains an infrastructure designed to support a Personal AI Coach. It includes data aggregation, event-driven triggers, and heuristic fallback logic.

**CRITICAL NOTE:** There is currently **NO actual LLM (Large Language Model), Neural Network, or Machine Learning model** integrated into the application. The system does not make HTTP calls to Gemini, OpenAI, Anthropic, or any other AI API.

## 2. What is ACTUALLY IMPLEMENTED (Heuristics & Data Prep)

### Context Builder (`src/lib/ai/context-builder.ts`)
- Gathers 360-degree user data (scores, 7-day sleep rolling averages, prayer history).
- Compresses this data into highly token-efficient vector strings (e.g., `PRYR_7D[OT:4, LT:1] | QRN:15m`).
- **Status:** IMPLEMENTED (Data preparation only).

### Prediction Engine (`src/lib/ai/prediction-engine.ts`)
- **Fake AI:** Generates predictions (Relapse Risk, Energy Curve, Sleep Quality) using **hardcoded mathematical formulas and `if/else` heuristic rules**, not machine learning.
- **Data Integrity Safety:** Recently audited and fixed. It now strictly returns `null` (Insufficient Data) if there isn't enough historical data to run the math formula, rather than outputting fabricated/default numbers.
- **Status:** IMPLEMENTED (As algorithmic heuristics).

### Correlation Engine (`src/lib/ai/correlation-engine.ts`)
- Uses a standard mathematical **Pearson R calculation** to find statistical correlations between variables (e.g., Sleep Duration vs. Daily Energy).
- **Data Integrity Safety:** Only returns correlations if a minimum sample size (e.g., 5 days of paired data) is met.
- **Status:** IMPLEMENTED (As statistical math, not ML).

### Memory Manager (`src/lib/ai/memory-manager.ts`)
- Attempts to extract "facts" and "preferences" from user chat text.
- **Status:** PARTIALLY IMPLEMENTED. It uses rudimentary Regex/String-matching (`if (text.includes("night shift"))`), rather than semantic LLM extraction.

## 3. What is PLANNED / NOT IMPLEMENTED

1. **External LLM Integration:** The actual connection to an API (like `@google/genai`) to pass the `CompressedContext` string into a System Prompt.
2. **Generative Inference Loop:** The ability for the AI Coach to read the context and dynamically generate conversational responses or actionable schedule changes.
3. **Semantic Memory Extraction:** Replacing the string-matching memory manager with an LLM call that intelligently extracts facts into IndexedDB.
4. **Dynamic AI Recommendations:** Replacing the currently hardcoded scoring recommendations (e.g. `if sleep < 6 return "Go to bed early"`) with personalized LLM-generated insights.
