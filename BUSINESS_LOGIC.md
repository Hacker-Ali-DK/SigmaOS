# Business Logic & Scoring Systems

## 1. Deen (Spiritual) Scoring
The Deen score evaluates a user's spiritual consistency.
**Source:** `src/lib/scoring/scoring-service.ts`

### Formula
`Base Weights: Prayers (60%) + Qur'an (25%) + Deen Goals (15%)`

### Rules & Normalization
- If a category is completely untracked (e.g. user hasn't logged any Deen goals), its weight is excluded, and the remaining weights are proportionally redistributed to equal 100%.
- **Prayer Points:**
  - `prayed_on_time`: 1.0 (100%)
  - `prayed_late`: 0.5 (50%)
  - `missed`: 0.0 (0%)
  - `not_tracked`: Ignored from denominator.
- **Qur'an Points:**
  - `(Qur'an Minutes / Target Minutes) * 100`, capped at 100.
- **Clamping:** Final score is clamped between 10 and 100.

## 2. Discipline Scoring
The Discipline score measures adherence to daily routines and habits.

### Formula
`Base Weights: Routines (40%) + Water (20%) + Workout (20%) + Habits Goals (20%)`

### Rules & Normalization
- Functions exactly like Deen scoring with dynamic weight redistribution.
- **Routine Points:** `(Completed Routines / Total Routines) * 100`
- **Water/Workout Points:** `(Logged Amount / Target Amount) * 100`

## 3. Wellness (Physical) Scoring
Evaluates physiological health markers.

### Formula
`Base Weights: Sleep (60%) + Meals (20%) + Health Goals (20%)`

### Rules
- **Sleep Points:** 
  - Max points achieved at user's `dailySleepTarget` (default 7.5 hours).
  - Penalty curve applied for sleeping under 6 hours or over 9 hours.
  - Quality Rating (1-5) acts as a multiplier (e.g., rating of 1 reduces score by 30%).

## 4. Overall Recovery Score (Alignment)
The global ring displayed on the dashboard.

### Formula
`Recovery Score = (Sleep * 0.30) + (Deen * 0.20) + (Dopamine * 0.15) + (Water * 0.10) + (Routines * 0.15) + (Nutrition * 0.10)`

### Rules
- **Dopamine Points:** Based on `cleanStreak`.
  - Day 0 (Relapse): 0 points
  - Day 1-3: Linear ramp up to 50
  - Day 7+: 100 points
- **Zero-Floor Avoidance:** The absolute minimum score the UI will display is 10, to prevent demotivation, unless explicitly 0 data is entered for days.

## 5. Offline Solar Prayer Calculations
**Source:** `src/lib/deen/prayer-engine.ts`
- Uses exact astronomical hour angles ($\cos H$) and solar declination formulas.
- High-Latitude fallback: If absolute latitude $> 48^\circ$ and the sun does not set/rise enough to produce a valid angle, it automatically switches to a proportional Night-Fraction calculation ($\frac{1}{7}$ of the night duration).
- Applies method-specific timezone rules (e.g., Umm al-Qura fixes Isha exactly 90 minutes after Maghrib, or 120 minutes in Ramadan).
