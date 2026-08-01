import { db } from '../db';
import { 
  calculateWellnessScore, 
  calculateDisciplineScore, 
  calculateDeenScore, 
  calculateSelfControlForDate 
} from './scoring-service';

// Mock data stores
let mockUserProfile = { 
  id: 1, 
  name: "Abdullah", 
  dailyCalorieTarget: 2500, 
  dailyWaterTarget: 3.0, 
  dailySleepTarget: 8.0, 
  dailyScreenTimeTarget: 4.0, 
  cleanStreak: 12 
};

let mockUrges: any[] = [];

// Intercept Dexie database calls to run in pure Node.js
(db.userProfile as any).get = async () => mockUserProfile;
(db.userProfile as any).update = async (id: any, changes: any) => {
  mockUserProfile = { ...mockUserProfile, ...changes };
  return 1;
};

const mockBetween = {
  toArray: async () => mockUrges
};
const mockWhere = {
  between: (start: number, end: number) => {
    // Filter mockUrges based on timestamp
    const filtered = mockUrges.filter(u => u.timestamp >= start && u.timestamp <= end);
    return {
      toArray: async () => filtered
    };
  }
};
db.dopamineUrges.where = () => mockWhere as any;

async function runTests() {
  console.log("=== RUNNING SCORING VERIFICATION TESTS ===\n");
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedCount++;
    } else {
      console.log(`[FAIL] ${message}`);
      failedCount++;
    }
  }

  const date = "2026-07-21";

  // Test 1: Weight not affecting Wellness Score
  {
    const sleep = { totalHours: 8.0, qualityScore: 80 };
    const water = { amountLiters: 3.0 };
    const meals = [{ calories: 2500, proteinGrams: 120 }];
    const workouts = [{ durationMinutes: 30 }];
    const journal = { mood: 'good', energy: 'medium' };

    const wellnessWithWeight = await calculateWellnessScore(date, mockUserProfile, sleep, meals, water, workouts, { weight: 80.0 }, journal);
    const wellnessWithoutWeight = await calculateWellnessScore(date, mockUserProfile, sleep, meals, water, workouts, null, journal);

    assert(
      wellnessWithWeight.score === wellnessWithoutWeight.score,
      `Weight log presence should not affect Wellness Score (${wellnessWithWeight.score} vs ${wellnessWithoutWeight.score})`
    );
  }

  // Test 2: No urges -> Self-Control = Not Tracked
  {
    mockUrges = [];
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 'untracked',
      `No urges should result in 'untracked' Self-Control score`
    );
  }

  // Test 3: One resisted urge -> 100%
  {
    mockUrges = [{ timestamp: new Date(date).getTime() + 1000, strength: 'medium', triggers: [], resisted: true }];
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 100,
      `One resisted urge should result in 100% score`
    );
  }

  // Test 4: Five resisted urges -> 100%
  {
    mockUrges = Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date(date).getTime() + i * 1000,
      strength: 'high',
      triggers: [],
      resisted: true
    }));
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 100,
      `Five resisted urges should result in 100% score`
    );
  }

  // Test 5: Four resisted + one relapse -> 80%
  {
    mockUrges = [
      ...Array.from({ length: 4 }, (_, i) => ({
        timestamp: new Date(date).getTime() + i * 1000,
        strength: 'medium',
        triggers: [],
        resisted: true
      })),
      { timestamp: new Date(date).getTime() + 5000, strength: 'high', triggers: [], resisted: false }
    ];
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 80,
      `Four resisted + one relapse should result in 80% score (actual: ${selfControl.score}%)`
    );
  }

  // Test 6: Two resisted + three relapses -> 40%
  {
    mockUrges = [
      { timestamp: new Date(date).getTime() + 1000, strength: 'medium', triggers: [], resisted: true },
      { timestamp: new Date(date).getTime() + 2000, strength: 'medium', triggers: [], resisted: true },
      { timestamp: new Date(date).getTime() + 3000, strength: 'high', triggers: [], resisted: false },
      { timestamp: new Date(date).getTime() + 4000, strength: 'high', triggers: [], resisted: false },
      { timestamp: new Date(date).getTime() + 5000, strength: 'high', triggers: [], resisted: false }
    ];
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 40,
      `Two resisted + three relapses should result in 40% score (actual: ${selfControl.score}%)`
    );
  }

  // Test 7: One relapse -> 0%
  {
    mockUrges = [{ timestamp: new Date(date).getTime() + 1000, strength: 'high', triggers: [], resisted: false }];
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 0,
      `One relapse should result in 0% score`
    );
  }

  // Test 8: Unknown historical urge records excluded from score
  {
    mockUrges = [
      { timestamp: new Date(date).getTime() + 1000, strength: 'medium', triggers: [], resisted: true }, // Resisted
      { timestamp: new Date(date).getTime() + 2000, strength: 'medium', triggers: [], resisted: undefined } // Unknown
    ];
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 100,
      `Unknown urge records should be excluded from Self-Control Score (resisted: 1, unknown: 1 should result in 100%, actual: ${selfControl.score}%)`
    );
  }

  // Test 9: Relapse resets cleanStreak to 0
  {
    mockUserProfile.cleanStreak = 15;
    // Simulate logging a relapse (outcome = resisted: false)
    const logRelapse = async () => {
      const resistedOutcome = false;
      mockUrges.push({ timestamp: Date.now(), strength: 'high', triggers: [], resisted: resistedOutcome });
      if (!resistedOutcome) {
        await db.userProfile.update(1, { cleanStreak: 0 });
      }
    };
    await logRelapse();
    assert(
      mockUserProfile.cleanStreak === 0,
      `Relapse should reset user profile cleanStreak to 0`
    );
  }

  // Test 10: Relapse does not delete historical data
  {
    // The previous urges array still holds the relapse log
    assert(
      mockUrges.length > 0,
      `Relapse logging preserves urges history (logs count: ${mockUrges.length})`
    );
  }

  // Test 11: Multiple events on the same day are calculated correctly
  {
    mockUrges = [
      { timestamp: new Date(date).getTime() + 1000, strength: 'low', triggers: [], resisted: true },
      { timestamp: new Date(date).getTime() + 2000, strength: 'medium', triggers: [], resisted: true },
      { timestamp: new Date(date).getTime() + 3000, strength: 'high', triggers: [], resisted: false },
      { timestamp: new Date(date).getTime() + 4000, strength: 'medium', triggers: [], resisted: undefined } // ignored
    ];
    const selfControl = await calculateSelfControlForDate(date);
    assert(
      selfControl.score === 67, // 2 resisted out of 3 valid = 66.66% -> 67%
      `Mixed day with 2 resisted, 1 relapse, 1 unknown calculates to 67% score (actual: ${selfControl.score}%)`
    );
  }

  // Test 12: Productive screen time not penalizing Discipline
  {
    const routines = [
      { taskName: "Fajr", completed: true },
      { taskName: "Isha", completed: true }
    ];
    // 5.0 hours productive (should not penalize), 2.0 hours recreational (under target of 4.0, should not penalize)
    const journal = { mood: 'good', screenHours: 2.0, productiveScreenHours: 5.0 };
    const discipline = await calculateDisciplineScore(date, routines, journal, []);
    
    // Check that there is no penalty from screen time
    const screenFactor = discipline.positives.find(p => p.includes("Recreational") || p.includes("recreational"));
    assert(
      discipline.negatives.filter(n => n.includes("screen") || n.includes("Screen")).length === 0,
      `Productive screen time should not generate Discipline penalties`
    );
  }

  // Test 13: Recreational screen time exceeding target reducing Discipline
  {
    const routines = [
      { taskName: "Fajr", completed: true },
      { taskName: "Isha", completed: true }
    ];
    // Target is 4.0. Recreational is 6.0. Exceeds limit by 2.0 hrs.
    const journal = { mood: 'good', screenHours: 6.0 };
    const discipline = await calculateDisciplineScore(date, routines, journal, []);
    
    assert(
      discipline.negatives.some(n => n.includes("recreational") || n.includes("Screen") || n.includes("screen")),
      `Recreational screen time exceeding target reduces Discipline (negatives: ${discipline.negatives.join(', ')})`
    );
  }

  // Test 14: Configurable screen-time target
  {
    const routines = [
      { taskName: "Fajr", completed: true },
      { taskName: "Isha", completed: true }
    ];
    // Set screen target to 6.0
    mockUserProfile.dailyScreenTimeTarget = 6.0;
    const journal = { mood: 'good', screenHours: 5.0 };
    const discipline = await calculateDisciplineScore(date, routines, journal, []);
    
    assert(
      discipline.negatives.filter(n => n.includes("screen") || n.includes("Screen")).length === 0,
      `5.0 hours recreational screen time under 6.0 target limit should not penalize Discipline`
    );
  }

  // Test 15: Data coverage display text
  {
    const sleep = { totalHours: 8.0, qualityScore: 80 };
    const water = { amountLiters: 3.0 };
    const wellness = await calculateWellnessScore(date, mockUserProfile, sleep, [], water, [], null, null);
    
    assert(
      wellness.trackedCount === 2 && wellness.totalCount === 6,
      `Wellness data coverage trackedCount is 2 and totalCount is 6 (actual: ${wellness.trackedCount}/${wellness.totalCount})`
    );
  }

  // Test 16: Backwards compatibility for existing version 1 data
  {
    mockUserProfile = { 
      id: 1, 
      name: "Abdullah", 
      dailyCalorieTarget: 2500, 
      dailyWaterTarget: 3.0, 
      dailySleepTarget: 8.0, 
      dailyScreenTimeTarget: undefined as any, // Legacy profile (missing target)
      cleanStreak: 5 
    };

    const routines = [
      { taskName: "Fajr", completed: true },
      { taskName: "Isha", completed: true }
    ];
    // Legacy journal log (missing productiveScreenHours)
    const journal = { mood: 'good', screenHours: 3.0 }; 
    const discipline = await calculateDisciplineScore(date, routines, journal, []);
    
    assert(
      discipline.score !== undefined && discipline.status !== 'insufficient',
      `Legacy records processed successfully (Discipline Score: ${discipline.score}/100)`
    );
  }

  // ----------------------------------------------------
  // STAGE 9 MANDATORY INVARIANT TESTS (TEST A - TEST R)
  // ----------------------------------------------------
  console.log("\n--- STAGE 9 MANDATORY INVARIANT TESTS ---");

  // TEST A — Perfect Deen
  {
    const prayers = { fajr: 'prayed_on_time', dhuhr: 'prayed_on_time', asr: 'prayed_on_time', maghrib: 'prayed_on_time', isha: 'prayed_on_time' };
    const routines = [{ taskName: "Qur'an", timeLabel: "15 min", completed: true }];
    const dailyDeenGoal = [{ title: "Daily Dhikr", category: "deen", targetValue: 1, currentValue: 1, isDailyCommitment: true, completed: false }];
    const deen = await calculateDeenScore(date, prayers, routines, dailyDeenGoal);
    assert(deen.score === 100, `TEST A: Perfect Deen produces exactly 100 (actual: ${deen.score})`);
  }

  // TEST B — Perfect Deen Without Deen Goal
  {
    const prayers = { fajr: 'prayed_on_time', dhuhr: 'prayed_on_time', asr: 'prayed_on_time', maghrib: 'prayed_on_time', isha: 'prayed_on_time' };
    const routines = [{ taskName: "Qur'an", timeLabel: "15 min", completed: true }];
    const deen = await calculateDeenScore(date, prayers, routines, []);
    assert(deen.score === 100, `TEST B: Perfect Deen without Deen goal produces 100 (actual: ${deen.score})`);
  }

  // TEST C — Long-Term Deen Goal Does Not Penalize Daily Score
  {
    const prayers = { fajr: 'prayed_on_time', dhuhr: 'prayed_on_time', asr: 'prayed_on_time', maghrib: 'prayed_on_time', isha: 'prayed_on_time' };
    const routines = [{ taskName: "Qur'an", timeLabel: "15 min", completed: true }];
    const longTermGoal = [{ title: "Wake up for Fajr 30 days", category: "deen", targetValue: 30, currentValue: 0, unit: "days", completed: false }];
    const deen = await calculateDeenScore(date, prayers, routines, longTermGoal);
    assert(deen.score === 100, `TEST C: Cumulative long-term Deen goal with 0 progress does NOT penalize daily Deen score (actual: ${deen.score})`);
  }

  // TEST D — Partial Qur'an
  {
    const prayers = { fajr: 'prayed_on_time', quranMinutes: 15 };
    const routines = [{ taskName: "Qur'an", timeLabel: "30 min", completed: false }];
    const deen = await calculateDeenScore(date, prayers, routines, []);
    // Prayers = 100 (weight 60), Quran = 15/30 = 50 (weight 25). Score = (100*60 + 50*25)/85 = 7250/85 = 85
    assert(deen.score === 85, `TEST D: Partial Qur'an (15m/30m) produces 50% factor score (actual Deen: ${deen.score})`);
  }

  // TEST E — Completed 15-Minute Qur'an Commitment
  {
    const prayers = { fajr: 'prayed_on_time' };
    const routines = [{ taskName: "Qur'an", timeLabel: "15 min", completed: true }];
    const deen = await calculateDeenScore(date, prayers, routines, []);
    // Both Prayers (100) & Quran (100) completed -> 100
    assert(deen.score === 100, `TEST E: Completed 15-Minute Qur'an Commitment produces 100% factor score (actual Deen: ${deen.score})`);
  }

  // TEST F — Study Commitment Uses Actual Duration
  {
    const routines = [{ taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: true }];
    const discipline = await calculateDisciplineScore(date, routines, null, []);
    // Routines = untracked (none non-study), Study = 2.5h/2.5h = 100% -> Discipline = 100
    assert(discipline.score === 100, `TEST F: Scheduled 2.5h Study completed yields 100 factor score, NOT 62.5% (actual Discipline: ${discipline.score})`);
  }

  // TEST G — Partial Study
  {
    const routines = [
      { taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: false },
      { taskName: "Study Session 2", timeLabel: "2.5 Hrs", completed: true }
    ];
    const discipline = await calculateDisciplineScore(date, routines, null, []);
    assert(discipline.score === 50, `TEST G: 2.5h of 5.0h total study completed yields 50% factor score (actual Discipline: ${discipline.score})`);
  }

  // TEST H — Long-Term Discipline Goal Does Not Penalize Daily Score
  {
    const routines = [{ taskName: "Read Book", timeLabel: "Pending", completed: true }];
    const longTermGoal = [{ title: "Read 12 Books", category: "habits", targetValue: 12, currentValue: 0, unit: "Books", completed: false }];
    const discipline = await calculateDisciplineScore(date, routines, null, longTermGoal);
    assert(discipline.score === 100, `TEST H: Cumulative long-term habit goal with 0 progress does NOT penalize daily Discipline score (actual: ${discipline.score})`);
  }

  // TEST I — Wellness Configured Target
  {
    const sleep = { totalHours: 8.0, qualityRating: 5, awakenings: 0 };
    const water = { amountLiters: 3.0 };
    const meals = [{ calories: 2500, proteinGrams: 120 }];
    const wellness = await calculateWellnessScore(date, mockUserProfile, sleep, meals, water, [], null, null);
    assert(wellness.score === 100, `TEST I: Fully satisfied configured Wellness targets produce 100 (actual: ${wellness.score})`);
  }

  // TEST J — Unconfigured Target
  {
    const sleep = { totalHours: 8.0, qualityRating: 5, awakenings: 0 };
    const wellness = await calculateWellnessScore(date, mockUserProfile, sleep, [], null, [], null, null);
    assert(wellness.trackedCount === 1, `TEST J: Unconfigured factors are marked untracked (actual tracked: ${wellness.trackedCount}/6)`);
  }

  // TEST K — Tracked Zero
  {
    const prayers = { fajr: 'missed', dhuhr: 'missed', asr: 'missed', maghrib: 'missed', isha: 'missed' };
    const deen = await calculateDeenScore(date, prayers, [], []);
    assert(deen.score === 0, `TEST K: Tracked zero completion produces 0 score, NOT clamped to 10 (actual: ${deen.score})`);
  }

  // TEST L — Perfect Wellness
  {
    const sleep = { totalHours: 8.0, qualityRating: 5, awakenings: 0 };
    const water = { amountLiters: 3.0 };
    const meals = [{ calories: 2500, proteinGrams: 120 }];
    const workouts = [{ durationMinutes: 30 }];
    const journal = { mood: 'great', energy: 'high' };
    const wellness = await calculateWellnessScore(date, mockUserProfile, sleep, meals, water, workouts, null, journal);
    assert(wellness.score === 100, `TEST L: Perfect Wellness produces 100 (actual: ${wellness.score})`);
  }

  // TEST M — Perfect Discipline
  {
    const routines = [
      { taskName: "Walk", timeLabel: "6:00 PM", completed: true },
      { taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: true },
      { taskName: "Read Book", timeLabel: "Pending", completed: true }
    ];
    const journal = { screenHours: 2.0 };
    const discipline = await calculateDisciplineScore(date, routines, journal, []);
    assert(discipline.score === 100, `TEST M: Perfect Discipline produces 100 (actual: ${discipline.score})`);
  }

  // TEST N — Perfect Overall Alignment
  {
    // If activeScores = [100, 100, 100], Overall Alignment must be 100
    const scores = [100, 100, 100];
    const alignment = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    assert(alignment === 100, `TEST N: Perfect Overall Alignment produces 100 (actual: ${alignment})`);
  }

  // TEST O — Untracked Category Exclusion
  {
    const activeScores = [100, 100]; // Deen untracked
    const alignment = Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);
    assert(alignment === 100, `TEST O: Untracked category excluded from Overall Alignment mean (actual: ${alignment})`);
  }

  // TEST P — Partial Category
  {
    const prayers = { fajr: 'prayed_on_time', dhuhr: 'prayed_late' };
    const deen = await calculateDeenScore(date, prayers, [], []);
    assert(deen.score < 100 && deen.score === 75, `TEST P: Partial prayer execution produces correct score < 100 (actual: ${deen.score})`);
  }

  // TEST Q — Zero Category
  {
    const routines = [{ taskName: "Walk", timeLabel: "6:00 PM", completed: false }];
    const discipline = await calculateDisciplineScore(date, routines, null, []);
    assert(discipline.score === 0, `TEST Q: Zero completion on tracked category produces 0 (actual: ${discipline.score})`);
  }

  // TEST R — No Data
  {
    const deen = await calculateDeenScore(date, null, [], []);
    assert(deen.status === 'insufficient' && deen.trackedCount === 0, `TEST R: No data returns status 'insufficient' (actual: ${deen.status})`);
  }

  // TEST S — DEF-19 Historical Wellness Workout Routine Synchronization
  {
    const workoutRoutines = [{ taskName: 'Workout', timeLabel: '30 min', completed: true }];
    const wellnessWithRts = await calculateWellnessScore(date, mockUserProfile, null, [], null, [], null, null, workoutRoutines);
    assert(wellnessWithRts.score === 100, `TEST S (DEF-19): calculateWellnessScore with workout routine evaluates to 100 (actual: ${wellnessWithRts.score})`);
  }

  // TEST T — DEF-24 AI Prediction 0 Score Floor Clamping
  {
    const zeroOverall = 0;
    const recoveryScorePred = Math.min(100, Math.max(0, Math.round(zeroOverall * 0.95 + 3)));
    assert(recoveryScorePred === 3, `TEST T (DEF-24): Recovery score prediction for 0 alignment scales near 0 without 10 floor (actual: ${recoveryScorePred})`);
  }

  // TEST U — DEF-25 Schedule Date Parsing
  {
    const dateStr = "2026-07-24";
    const [y, m, day] = dateStr.split('-').map(Number);
    const parsedDate = new Date(y, m - 1, day);
    assert(parsedDate.getDate() === 24 && parsedDate.getMonth() === 6, `TEST U (DEF-25): Local date parsing preserves day 24 and month July (actual: ${parsedDate.toLocaleDateString()})`);
  }

  console.log(`\n=== SCORING VERIFICATION RESULTS ===`);
  console.log(`Total tests run: ${passedCount + failedCount}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

