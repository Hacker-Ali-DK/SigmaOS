# Database Schema

## Technology
Recovery+ uses **IndexedDB** via the **Dexie.js** wrapper. There is NO backend server database. All data remains exclusively on the user's device.

**Current Version:** 9

## Dexie Stores Configuration
```typescript
this.version(9).stores({
  userProfile: 'id',
  prayers: '&date',
  dopamineUrges: '++id, timestamp, strength',
  sleep: '&date',
  water: '&date',
  meals: '++id, date, mealType',
  workouts: '++id, date',
  routines: '++id, [date+order], date',
  goals: '++id, category, completed',
  journal: '&date',
  weight: '&date',
  naps: '++id, date',
  chatMessages: '++id, sessionId, timestamp',
  aiMemory: 'key, category',
  aiCorrelations: 'pairKey, correlation',
  aiLearning: 'key, weight',
  eventStore: '++id, traceId, topic, priority, acknowledged',
  eventDeadLetter: '++id, topic, timestamp',
  scheduledReminders: '++id, reminderId, category, triggerTimestamp, priority, status, isSolarDependent',
  notificationHistory: '++id, reminderId, category, timestamp, userAction',
  dailyPlans: '&date, planId, status, createdAt',
  decisionHistory: '++id, decisionId, category, priority, status',
  planRevisions: '++id, planId, [planId+revisionId], parentRevisionId, timestamp',
  constraintCache: 'key, category, isHard',
});
```

## Detailed Table Definitions

### 1. `userProfile`
- **Purpose:** Stores user settings, location, and global targets.
- **Primary Key:** `id` (Always 1 for single-user mode)
- **Fields:**
  - `name`, `age`, `avatarUrl`
  - `dailyCalorieTarget`, `dailyWaterTarget`, `dailySleepTarget`, `dailyScreenTimeTarget`
  - `cleanStreak` (number) - Days since last major relapse.
  - `latitude`, `longitude`, `city`, `country`, `timezone` (geolocation data for prayer engine)
  - `prayerMethod`, `asrMethod`, `ishaPolicy` (calculation preferences)
  - `lastActiveDate`

### 2. `prayers`
- **Purpose:** Logs detailed status for the 5 daily prayers and Qur'an recitation.
- **Primary Key:** `date` (format: `YYYY-MM-DD`)
- **Fields:**
  - `fajr`, `dhuhr`, `asr`, `maghrib`, `isha` (object: `PrayerDetail` | string: `DetailedPrayerStatus` | boolean)
    - Valid Statuses: `'prayed_on_time'`, `'prayed_late'`, `'missed'`, `'not_tracked'`
  - `prayerStatuses` array
  - `quranMinutes` (number)
  - `calculationContext` (object) - Snapshot of solar calculations used that day.

### 3. `dopamineUrges`
- **Purpose:** Logs instances of urges/relapses for addiction recovery.
- **Primary Key:** `id` (Auto-increment)
- **Fields:**
  - `timestamp` (number) - Epoch time.
  - `strength` (string) - 'low', 'medium', 'high'
  - `triggers` (array of strings)
  - `notes` (string)
  - `resisted` (boolean)

### 4. `sleep` & `naps`
- **Purpose:** Tracks nocturnal sleep architecture and daytime naps.
- **`sleep` Table:** PK: `date`
  - `bedtime`, `waketime` (string HH:mm)
  - `totalHours`, `deepHours`, `lightHours`, `remHours`, `awakeHours` (number)
  - `qualityScore` (1-100), `qualityRating` (1-5)
  - `awakenings`, `notes`, `source`
- **`naps` Table:** PK: `id`
  - `date`, `startTime`, `endTime`, `durationMinutes`, `qualityRating`, `notes`, `source`

### 5. `routines`
- **Purpose:** Checklists for daily tasks (e.g., Morning Walk, Study).
- **Primary Key:** `id` (Auto-increment)
- **Indexes:** `[date+order]`, `date`
- **Fields:**
  - `date` (string)
  - `taskName` (string)
  - `completed` (boolean)
  - `timeLabel` (string) - e.g., "15 min", "2.5 Hrs"
  - `order` (number)

### 6. `goals`
- **Purpose:** Long-term and short-term tracking.
- **Primary Key:** `id` (Auto-increment)
- **Fields:**
  - `title`, `unit` (string)
  - `targetValue`, `currentValue` (number)
  - `category` (string) - e.g., 'health', 'deen', 'habits', 'career'
  - `completed` (boolean)
  - `createdAt` (number)

### 7. AI & Intelligence Tables
- **Status:** *IMPLEMENTED (Storage schema and basics)*
- **`aiMemory`:** Stores extracted facts/preferences. PK: `key`.
- **`aiCorrelations`:** Stores discovered statistical Pearson R correlations. PK: `pairKey`.
- **`aiLearning`:** Stores machine learning weights/preferences. PK: `key`.
- **`chatMessages`:** Stores conversation history with the AI coach. PK: `id`.

### 8. Event Bus & Messaging Tables
- **`eventStore`:** Offline event persistence to prevent dropping events. PK: `id`.
- **`eventDeadLetter`:** Holds failed/rejected events for retry or debugging. PK: `id`.

### 9. Scheduling & Notifications Tables
- **`scheduledReminders`:** Stores system reminders and notification triggers. PK: `id`.
- **`notificationHistory`:** Stores user interaction with notifications. PK: `id`.

### 10. Planning & Decisions Tables
- **`dailyPlans`:** High-level structured plan for a day. PK: `date`.
- **`planRevisions`:** Tracks modifications/adjustments to the daily plan. PK: `id`.
- **`decisionHistory`:** Audit log of automated decisions made by the planning engine. PK: `id`.
- **`constraintCache`:** Caches constraints for the schedule. PK: `key`.

## Migrations and Constraints
- The system includes lossless migrations from previous versions up to 9.
- Version 5 migrated legacy boolean `prayers` logs to explicit objects/statuses without falsifying timestamps.
- **Constraint:** `date` fields strictly use local `YYYY-MM-DD` strings to prevent timezone-shifting bugs in query logic.
