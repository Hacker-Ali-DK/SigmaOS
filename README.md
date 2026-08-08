# Recovery+

Recovery+ is a progressive, offline-first personal wellness, habit-tracking, and spiritual alignment application. Designed as a daily companion, Recovery+ empowers users to build consistency, overcome addictions, track physical health and sleep architecture, log detailed prayers with solar calculations, analyze Deen trends, and gain structured insights through an offline AI coach.

## Tech Stack
* **Framework:** Next.js 16.2.10 (React 19)
* **Styling:** Tailwind CSS 4.0
* **State Management:** Zustand
* **Database:** Dexie.js (IndexedDB)
* **Icons:** Lucide React
* **Components:** Radix UI Primitives, Framer Motion
* **Forms & Validation:** React Hook Form, Zod

## Setup and Installation

1. **Clone the repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Open application:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Development Commands

* `npm run dev`: Starts the Next.js development server with Turbopack.
* `npm run build`: Builds the production bundle.
* `npm run start`: Starts the production server.
* `npm run lint`: Runs ESLint for code quality checks.

## Project Structure

```
├── public/                 # Static assets and manifest.json for PWA
├── src/
│   ├── app/                # Next.js App Router (page.tsx, layout.tsx, globals.css)
│   ├── components/         # Reusable UI components (navigation-bar, splash-screen)
│   ├── features/           # Feature-specific views
│   │   ├── analytics/      # Overall analytics
│   │   ├── dashboard/      # Dashboard and prayer timeline
│   │   ├── dopamine/       # Relapse and urge tracking
│   │   ├── goals/          # Goal tracking and completion
│   │   ├── habits/         # Habit grid (water, workout, reading)
│   │   ├── health/         # Nutrition logging and Sleep architecture
│   │   ├── profile/        # User profile, journal, backup/restore
│   │   └── schedule/       # Routine and task scheduling
│   └── lib/                # Core business logic and services
│       ├── ai/             # Prediction, correlation, and context building engines
│       ├── deen/           # Solar calculation and Deen tracking
│       ├── events/         # Application event bus
│       ├── notifications/  # Notification logic and adaptive intelligence
│       ├── planning/       # Trigger coordination
│       ├── scoring/        # Health and recovery scoring engines
│       └── db.ts           # Dexie IndexedDB schema and configuration
```

## Documentation

Comprehensive documentation can be found in the project root:
- `ARCHITECTURE.md` - Overall architecture and offline-first design
- `DATABASE_SCHEMA.md` - Dexie/IndexedDB schema and relationships
- `DATA_FLOW.md` - Application data and event flow
- `FEATURE_SPEC.md` - Detailed feature breakdown
- `BUSINESS_LOGIC.md` - Scoring rules and formulas
- `UI_DESIGN_SYSTEM.md` - Styling and UX guidelines
- `AI_SPEC.md` - AI and prediction engine architecture
- `EVENT_SYSTEM.md` - Event bus implementation
- `TEST_PLAN.md` - Testing strategies
- `CHANGELOG.md` - Project history
- `SECURITY.md` - Security considerations
- `ROADMAP.md` - Current, planned, and unimplemented features
