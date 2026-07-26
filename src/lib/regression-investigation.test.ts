import { ensureRoutinesForDate, useAppStore } from './store';
import { dayBoundaryManager } from './day-boundary-manager';
import { db } from './db';
import { 
  calculateWellnessScore, 
  calculateDisciplineScore, 
  calculateDeenScore, 
  calculateSelfControlForDate,
  deduplicateRoutinesInput
} from './scoring/scoring-service';

async function runRegressionTests() {
  console.log("=================================================");
  console.log("=== RECOVERY+ REGRESSION INVESTIGATION TESTS ===");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.log(`[FAIL] ${message}`);
      failed++;
    }
  }

  const testDate = '2026-07-26';

  // ----------------------------------------------------
  // TEST 1: Concurrent Seeding Deduplication
  // ----------------------------------------------------
  console.log("--- TEST 1: Concurrent Seeding Deduplication ---");
  await db.routines.where({ date: testDate }).delete();

  // Fire 5 concurrent seeding requests
  await Promise.all([
    ensureRoutinesForDate(testDate),
    ensureRoutinesForDate(testDate),
    ensureRoutinesForDate(testDate),
    ensureRoutinesForDate(testDate),
    ensureRoutinesForDate(testDate)
  ]);

  const routinesCount = await db.routines.where({ date: testDate }).count();
  assert(
    routinesCount === 12,
    `5 concurrent calls to ensureRoutinesForDate resulted in exactly 12 routines (actual: ${routinesCount})`
  );

  // ----------------------------------------------------
  // TEST 2: Existing Database Duplicate Pruning with Completed Preservation
  // ----------------------------------------------------
  console.log("\n--- TEST 2: Duplicate Pruning & Completed Preservation ---");
  await db.routines.where({ date: testDate }).delete();

  // Artificially inject duplicates into DB (12 uncompleted + 12 where Fajr is completed)
  const initialRoutines = [
    { date: testDate, taskName: "Fajr", timeLabel: "5:05 AM", completed: false, order: 1 },
    { date: testDate, taskName: "Qur'an", timeLabel: "15 min", completed: false, order: 2 },
    { date: testDate, taskName: "Workout", timeLabel: "30 min", completed: false, order: 3 },
    { date: testDate, taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: false, order: 4 },
    { date: testDate, taskName: "Dhuhr", timeLabel: "1:15 PM", completed: false, order: 5 },
    { date: testDate, taskName: "Lunch", timeLabel: "1:45 PM", completed: false, order: 6 },
    { date: testDate, taskName: "Asr", timeLabel: "5:00 PM", completed: false, order: 7 },
    { date: testDate, taskName: "Walk", timeLabel: "6:00 PM", completed: false, order: 8 },
    { date: testDate, taskName: "Maghrib", timeLabel: "7:24 PM", completed: false, order: 9 },
    { date: testDate, taskName: "Isha", timeLabel: "8:41 PM", completed: false, order: 10 },
    { date: testDate, taskName: "Read Book", timeLabel: "Pending", completed: false, order: 11 },
    { date: testDate, taskName: "Sleep", timeLabel: "10:30 PM", completed: false, order: 12 },
    // Duplicate set with Fajr completed
    { date: testDate, taskName: "Fajr", timeLabel: "5:05 AM", completed: true, order: 1 },
    { date: testDate, taskName: "Qur'an", timeLabel: "15 min", completed: false, order: 2 },
    { date: testDate, taskName: "Workout", timeLabel: "30 min", completed: false, order: 3 },
    { date: testDate, taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: false, order: 4 },
    { date: testDate, taskName: "Dhuhr", timeLabel: "1:15 PM", completed: false, order: 5 },
    { date: testDate, taskName: "Lunch", timeLabel: "1:45 PM", completed: false, order: 6 },
    { date: testDate, taskName: "Asr", timeLabel: "5:00 PM", completed: false, order: 7 },
    { date: testDate, taskName: "Walk", timeLabel: "6:00 PM", completed: false, order: 8 },
    { date: testDate, taskName: "Maghrib", timeLabel: "7:24 PM", completed: false, order: 9 },
    { date: testDate, taskName: "Isha", timeLabel: "8:41 PM", completed: false, order: 10 },
    { date: testDate, taskName: "Read Book", timeLabel: "Pending", completed: false, order: 11 },
    { date: testDate, taskName: "Sleep", timeLabel: "10:30 PM", completed: false, order: 12 }
  ];

  for (const r of initialRoutines) {
    await db.routines.add(r);
  }

  const rawCountBefore = await db.routines.where({ date: testDate }).count();
  assert(rawCountBefore === 24, `Successfully injected 24 duplicate records for testing`);

  // Run ensureRoutinesForDate to prune duplicates
  await ensureRoutinesForDate(testDate);

  const prunedTasks = await db.routines.where({ date: testDate }).toArray();
  assert(prunedTasks.length === 12, `Pruned duplicate records down to 12 unique items (actual: ${prunedTasks.length})`);

  const fajrTask = prunedTasks.find(t => t.taskName === 'Fajr');
  assert(
    fajrTask?.completed === true,
    `Preserved completed record for Fajr after pruning duplicates`
  );

  // ----------------------------------------------------
  // TEST 3: Day Boundary Clean-Streak Finalization
  // ----------------------------------------------------
  console.log("\n--- TEST 3: Day Boundary Clean-Streak Finalization ---");

  // Setup user profile with initial streak = 5
  await db.userProfile.put({
    id: 1,
    name: "Abdullah",
    dailyCalorieTarget: 2500,
    dailyWaterTarget: 3.0,
    dailySleepTarget: 8.0,
    cleanStreak: 5
  });

  // Finalize transition from 2026-07-24 to 2026-07-25 with no relapses
  await dayBoundaryManager.finalizeCleanStreak('2026-07-24', '2026-07-25');
  let updatedProfile = await db.userProfile.get(1);
  assert(
    updatedProfile?.cleanStreak === 6,
    `Clean streak advanced from 5 to 6 after clean day boundary transition`
  );

  // Simulate relapse on 2026-07-25
  const relapseTimestamp = new Date('2026-07-25T14:30:00').getTime();
  await db.dopamineUrges.add({
    timestamp: relapseTimestamp,
    strength: 'high',
    triggers: ['stress'],
    resisted: false
  });

  // Finalize transition from 2026-07-25 to 2026-07-26
  await dayBoundaryManager.finalizeCleanStreak('2026-07-25', '2026-07-26');
  updatedProfile = await db.userProfile.get(1);
  assert(
    updatedProfile?.cleanStreak === 0,
    `Clean streak reset to 0 after day boundary transition with logged relapse`
  );

  // ----------------------------------------------------
  // TEST 4: Scoring Accuracy & Input Deduplication
  // ----------------------------------------------------
  console.log("\n--- TEST 4: Scoring Input Deduplication & Accuracy ---");

  const duplicateRoutinesForScoring = [
    { taskName: "Workout", timeLabel: "30 min", completed: false, order: 1 },
    { taskName: "Workout", timeLabel: "30 min", completed: true, order: 1 },
    { taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: false, order: 2 },
    { taskName: "Study Session 1", timeLabel: "2.5 Hrs", completed: false, order: 2 },
    { taskName: "Fajr", timeLabel: "5:05 AM", completed: false, order: 3 },
    { taskName: "Fajr", timeLabel: "5:05 AM", completed: true, order: 3 }
  ];

  const dedupedInputs = deduplicateRoutinesInput(duplicateRoutinesForScoring);
  assert(dedupedInputs.length === 3, `Deduplicated scoring inputs from 6 to 3 tasks`);
  assert(
    dedupedInputs.find(r => r.taskName === 'Workout')?.completed === true,
    `Scoring deduplication preserved completed Workout status`
  );
  assert(
    dedupedInputs.find(r => r.taskName === 'Fajr')?.completed === true,
    `Scoring deduplication preserved completed Fajr status`
  );

  const disciplineClean = await calculateDisciplineScore(testDate, [
    { taskName: "Workout", timeLabel: "30 min", completed: true }
  ], null, []);
  
  const disciplineWithDupes = await calculateDisciplineScore(testDate, [
    { taskName: "Workout", timeLabel: "30 min", completed: false },
    { taskName: "Workout", timeLabel: "30 min", completed: true }
  ], null, []);

  assert(
    disciplineClean.score === disciplineWithDupes.score,
    `Discipline score is identical regardless of input duplication (${disciplineClean.score} vs ${disciplineWithDupes.score})`
  );

  console.log("\n=================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch(err => {
  console.error(err);
  process.exit(1);
});
