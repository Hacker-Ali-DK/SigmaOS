# Business Logic & Scoring Systems

## 1. Deen (Spiritual) Scoring
The Deen score evaluates a user's spiritual consistency.
**Source:** `src/lib/scoring/scoring-service.ts`

### Formula
`Base Weights: Prayers (60%) + Qur'an (25%) + Islamic Goals (15%)`

### Rules & Normalization
- Strict baseline scoring applies (missing or untracked categories default to 0% and do not redistribute weights).
- **Prayer Points:**
  - `prayed_on_time`: 1.0 (100%)
  - `prayed_late`: 0.5 (50%)
  - `missed`: 0.0 (0%)
  - `not_tracked`: Ignored from denominator.
- **Qur'an Points:**
  - `(Qur'an Minutes / Target Minutes) * 100`, capped at 100.
- **Clamping:** Final score is clamped between 0 and 100.

## 2. Discipline Scoring
The Discipline score measures adherence to daily routines, learning, and self-control.

### Formula
`Base Weights: Routines (40%) + Study/Learning (20%) + Reading (15%) + Screen Time (15%) + Goal Progress (10%)`

### Rules & Normalization
- Strict baseline scoring applies (missing or untracked categories default to 0% and do not redistribute weights).
- **Routines:** Focuses on general tasks (excluding Deen tasks like prayers).
- **Study/Learning:** Compares fulfilled hours vs required hours based on time labels.
- **Screen Time:** Penalizes excessive recreational screen time over the daily limit.
- **Goal Progress:** Tracks active daily discipline commitments.

## 3. Wellness (Physical) Scoring
Evaluates physiological health markers and emotional states.

### Formula
`Base Weights: Sleep (25%) + Nutrition (25%) + Hydration (20%) + Physical Activity/Workout (15%) + Mood (7.5%) + Energy (7.5%)`

### Rules
- Strict baseline scoring applies (missing or untracked categories default to 0% and do not redistribute weights). 
- **Sleep Points:** 
  - Balances duration, awakenings, and quality score.
- **Nutrition Points:**
  - Calculates deviation from calorie target and assesses protein intake.
- **Mood & Energy:**
  - Derives scores from categorical journal inputs (e.g., 'great', 'anxious', 'high', 'low').

## 4. Overall Recovery Score (Alignment)
The global ring displayed on the dashboard.

### Formula
`Recovery Score = Average(Wellness, Discipline, Deen)`

### Rules
- The overall alignment is a strict mathematical average of the three main categories.
- If a category is `insufficient` or `untracked`, it is entirely omitted from the average.
- There is no longer a hardcoded zero-floor avoidance.

## 5. Offline Solar Prayer Calculations
**Source:** `src/lib/deen/prayer-engine.ts`
- Uses exact astronomical hour angles ($\cos H$) and solar declination formulas.
- High-Latitude fallback: If absolute latitude $> 48^\circ$ and the sun does not set/rise enough to produce a valid angle, it automatically switches to a proportional Night-Fraction calculation ($\frac{1}{7}$ of the night duration).
- Applies method-specific timezone rules (e.g., Umm al-Qura fixes Isha exactly 90 minutes after Maghrib, or 120 minutes in Ramadan).
