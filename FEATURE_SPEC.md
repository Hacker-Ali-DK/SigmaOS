# Feature Specification

## 1. Dashboard & Home Overview
- **Purpose:** Central hub for viewing daily progress.
- **Inputs:** Current local date (via `useAppStore`), Dexie live queries.
- **Outputs:** Overall Recovery score ring, Prayer timeline, Routine grid, Goal preview.
- **Implementation Status:** FULLY IMPLEMENTED

## 2. Solar Prayer Tracker
- **Purpose:** Tracks exact astronomical prayer times and user adherence.
- **Inputs:** GPS Coordinates, Date, Timezone, Calculation Method (e.g., MWL, ISNA), Asr Method (Standard/Hanafi), Isha Policy.
- **Outputs:** Timeline of Fajr, Dhuhr, Asr, Maghrib, Isha with timestamps.
- **User Interactions:** Click timeline nodes to cycle status (`prayed_on_time` -> `prayed_late` -> `missed` -> `not_tracked`), or use the Quick Add Modal.
- **Implementation Status:** FULLY IMPLEMENTED

## 3. Dopamine & Addiction Recovery
- **Purpose:** Track urges and calculate clean streaks.
- **Inputs:** User clicks on "Log Urge" (Low, Medium, High, Relapse), plus Triggers and Notes.
- **Outputs:** Resets clean streak (if relapse), logs urge timestamp to database.
- **Implementation Status:** FULLY IMPLEMENTED

## 4. Sleep & Nap Architecture (Health)
- **Purpose:** Monitor nocturnal sleep and daytime naps.
- **Inputs:** Bedtime, Wake time, Quality rating (1-5).
- **Outputs:** Total nocturnal hours (handling cross-midnight math), list of naps.
- **Implementation Status:** FULLY IMPLEMENTED

## 5. Nutrition Logging (Health)
- **Purpose:** Track meal intake and macronutrients.
- **Inputs:** Meal type, description, calories, protein grams.
- **Outputs:** Log of daily meals and totals.
- **Implementation Status:** FULLY IMPLEMENTED

## 6. Habits (Water, Workout, Qur'an, Study)
- **Purpose:** Track granular daily activities.
- **Inputs:** Incremental +/- buttons for water (liters), workout (minutes), Qur'an (minutes).
- **Outputs:** Progress bars mapped to daily targets from `userProfile`.
- **Implementation Status:** FULLY IMPLEMENTED

## 7. Goals
- **Purpose:** Long-term objective tracking.
- **Inputs:** Target value, current value, unit (e.g. %, kg, books). Incremental progress updates.
- **Outputs:** Active vs Completed lists, visual progress bars.
- **Implementation Status:** FULLY IMPLEMENTED

## 8. Schedule & Routines
- **Purpose:** Daily routine checklist and automated planning.
- **Inputs:** Task name, time label, completion status, ordering.
- **Outputs:** Reorderable checklist of daily tasks.
- **Implementation Status:** FULLY IMPLEMENTED

## 9. Analytics & Trends
- **Purpose:** View long-term progress and historical metrics.
- **Inputs:** Historical database records.
- **Outputs:** Trend charts, score histories, correlations.
- **Implementation Status:** FULLY IMPLEMENTED

## 10. AI Coach
- **Purpose:** Intelligent conversational agent for schedule optimization and spiritual advice.
- **Inputs:** User chat text, dense telemetry context strings.
- **Outputs:** Text responses, UI modification recommendations.
- **Implementation Status:** PARTIALLY IMPLEMENTED (Data preparation, basic correlations, and UI shell exist, but no external LLM integration is active. Responses are simulated/unavailable).

## 11. Backup & Restore
- **Purpose:** Offline data portability.
- **Inputs:** JSON file upload.
- **Outputs:** JSON file download (Export) / IndexedDB overwrite (Import).
- **Implementation Status:** FULLY IMPLEMENTED (Supports v1-v8 legacy migrations to v9).
