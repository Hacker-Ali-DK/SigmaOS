# Changelog

## Phase 3: Event-Driven & Scoring Refinements
- **Implemented** unified `EventBus` architecture to decouple scoring and planning modules.
- **Fixed** regression bugs in Deen scoring mathematical models.
- **Added** dynamic weight redistribution for omitted routine/habit tracking.
- **Refactored** design system tokens across multiple views (`UI_DESIGN_SYSTEM.md`).
- **Updated** PWA icons to the new Dragon Logo.

## Phase 2: Sleep & Health Analytics
- **Implemented** Sleep Architecture tracker, handling cross-midnight calculations.
- **Added** multiple nap logging.
- **Added** Goal tracking and detailed UI grid.
- **Refined** Dexie database to `version: 5` to support new metrics.

## Phase 1: Core Deen & Recovery Tracking
- **Implemented** offline-first Solar Prayer Calculation engine.
- **Built** Dopamine/Urge tracker with clean streak computation.
- **Created** basic Habit tracking (Water, Workout, Qur'an).
- **Established** initial Next.js + IndexedDB architecture.
