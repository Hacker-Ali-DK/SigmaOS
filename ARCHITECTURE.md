# Architecture

## Overall Architecture
Recovery+ is built as an **offline-first, client-side application** using Next.js. Despite using Next.js (which typically heavily utilizes SSR/SSR-capabilities), the core value proposition of Recovery+ relies on absolute privacy and immediate offline availability. 

The application architecture heavily favors the client:
1. **Client-Side Rendering (CSR):** Almost all primary features (`src/features/*`) are explicitly marked with `'use client'` to allow direct interaction with the browser's IndexedDB.
2. **Local Storage (IndexedDB):** No external database (e.g., PostgreSQL, Firebase) is used. All user data, metrics, and logs are stored locally using Dexie.js.
3. **Event-Driven Micro-Architecture:** Cross-module communication is handled via a custom Event Bus (`src/lib/events/event-bus.ts`) to prevent tightly coupled components and circular dependencies.

## Offline-First Design
- **Zero Network Dependency:** Solar prayer calculations (`src/lib/deen/prayer-engine.ts`), data storage, correlation analysis, and scoring happen entirely on-device.
- **PWA Ready:** The application includes a `manifest.json` and is structured to be installed as a Progressive Web App, enabling functionality even in airplane mode.
- **Backup & Restore:** Because data is entirely local, the app implements a robust JSON export/import system (`ProfileView` and `db.ts`) for data portability.

## Major Modules and Responsibilities

### 1. Presentation Layer (`src/app`, `src/features`, `src/components`)
- **App Router:** `src/app/page.tsx` serves as the primary shell.
- **Feature Views:** Each major capability (Dashboard, Habits, Goals, Sleep, Nutrition) is isolated in `src/features/*`.
- **Global State:** Uses `zustand` (`src/lib/store.ts`) for ephemeral UI state (e.g., currently selected date, active modal).

### 2. Data Layer (`src/lib/db.ts`)
- **Dexie DB Wrapper:** Defines the schema and manages database transactions.
- **Hooks:** Uses `dexie-react-hooks` (`useLiveQuery`) to bind UI components directly to database queries, enabling reactive, real-time updates when data changes.

### 3. Business Logic Layer (`src/lib/scoring`, `src/lib/deen`)
- **Scoring Services:** Calculates alignment, discipline, and wellness scores deterministically based on raw database logs.
- **Prayer Engine:** Houses astronomical algorithms to calculate exact transit times and solar angles based on the user's latitude and longitude.

### 4. Intelligence Layer (`src/lib/ai`, `src/lib/notifications`)
- **Prediction & Correlation:** Analyzes historical data to predict trends (e.g., relapse risk, sleep quality) and find Pearson R correlations.
- **Context Builder:** Formats raw telemetry into token-efficient strings for future implementation of LLM integrations.
- **Status:** *PARTIALLY IMPLEMENTED (Heuristics only. No actual LLM is currently integrated).*

### 5. Event System (`src/lib/events`)
- **Event Bus:** A lightweight pub/sub system ensuring decoupled communication (e.g., checking off a routine fires an event that the scoring engine listens to).

## Dependencies Between Modules
To maintain maintainability, the application follows strict dependency rules:
- **UI Components** can import **Services** (e.g., `scoring-service.ts`) and **Stores** (`db.ts`).
- **Services** can query **Stores** but should NEVER import **UI Components**.
- **AI Modules** consume **Stores** and **Services** but do not mutate state directly; they return vectors or emit events.
- **Event Bus** acts as the intermediary. If a Service needs to trigger an AI reaction, it fires an event rather than importing the AI module directly.
