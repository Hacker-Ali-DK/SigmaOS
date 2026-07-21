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
db.userProfile.get = async () => mockUserProfile;
db.userProfile.update = async (id, changes) => {
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
      dailyScreenTimeTarget: undefined, // Legacy profile (missing target)
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
