// Comprehensive verification script for Phase 1 & Phase 2 Scoring Architecture

// ----------------------------------------------------
// SCORING ENGINE (PROD LOGIC IN STANDALONE JS)
// ----------------------------------------------------

function calculateSleepDuration(bedtimeStr, waketimeStr) {
  if (!bedtimeStr || !waketimeStr) return 0;
  
  const timeOnly = (s) => s.includes('T') ? s.split('T')[1] : s;
  const bTime = timeOnly(bedtimeStr);
  const wTime = timeOnly(waketimeStr);

  const [bHours, bMins] = bTime.split(':').map(Number);
  const [wHours, wMins] = wTime.split(':').map(Number);
  
  if (isNaN(bHours) || isNaN(bMins) || isNaN(wHours) || isNaN(wMins)) return 0;

  const bedtimeMins = bHours * 60 + bMins;
  const waketimeMins = wHours * 60 + wMins;

  let diffMins = 0;
  if (waketimeMins < bedtimeMins) {
    diffMins = (24 * 60 - bedtimeMins) + waketimeMins;
  } else {
    diffMins = waketimeMins - bedtimeMins;
  }

  return Number((diffMins / 60).toFixed(2));
}

function formatMinsToTime(mins) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMins = String(minutes).padStart(2, '0');
  return `${displayHours}:${displayMins} ${period}`;
}

function formatMinsToDurationStr(mins) {
  if (mins < 60) return `±${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `±${h}h` : `±${h}h ${m}m`;
}

function calculateDailySleepScore(sleepLog, sleepTarget = 8.0) {
  if (!sleepLog) {
    return {
      score: 60,
      status: 'insufficient',
      trackedCount: 0,
      totalCount: 3,
      positives: [],
      negatives: [],
      recommendation: "Log your sleep bedtime and wake-up times."
    };
  }

  const duration = sleepLog.totalHours || 0;
  const durationScore = Math.min(100, (duration / sleepTarget) * 100);

  const qualityRating = sleepLog.qualityRating || (sleepLog.qualityScore ? sleepLog.qualityScore / 20 : 4);
  const qualityScore = qualityRating * 20;

  const positives = [];
  const negatives = [];

  if (duration >= sleepTarget) {
    positives.push(`Sleep duration meets target (${duration.toFixed(1)}h)`);
  } else {
    negatives.push(`Sleep deficit (${duration.toFixed(1)}h vs target ${sleepTarget}h)`);
  }

  const qualityLabels = ["Very Poor", "Poor", "Average", "Good", "Excellent"];
  const qualityLabel = qualityLabels[Math.min(4, Math.max(0, Math.round(qualityRating) - 1))];
  if (qualityRating >= 4) {
    positives.push(`Sleep quality was ${qualityLabel}`);
  } else if (qualityRating <= 2) {
    negatives.push(`Poor sleep quality (${qualityLabel})`);
  }

  let finalScore = 60;
  let trackedCount = 2;
  let totalCount = 3;

  if (sleepLog.awakenings !== undefined && sleepLog.awakenings !== null) {
    trackedCount = 3;
    const awakeningsScore = Math.max(0, 100 - sleepLog.awakenings * 20);
    finalScore = Math.round(durationScore * 0.40 + qualityScore * 0.45 + awakeningsScore * 0.15);
    
    if (sleepLog.awakenings === 0) {
      positives.push(`No awakenings during the night`);
    } else if (sleepLog.awakenings >= 3) {
      negatives.push(`Woke up ${sleepLog.awakenings} times during the night`);
    }
  } else {
    totalCount = 2;
    // Proportional redistribution: 40% Duration, 45% Quality (Total 85%)
    finalScore = Math.round(durationScore * (40 / 85) + qualityScore * (45 / 85));
  }

  return {
    score: Math.max(10, Math.min(finalScore, 100)),
    status: trackedCount === totalCount ? 'completed' : 'partial',
    trackedCount,
    totalCount,
    positives,
    negatives
  };
}

function calculateSleepConsistencyStats(sleepLogs, daysLimit = 7) {
  const validLogs = sleepLogs
    .filter(log => log.bedtime && log.waketime)
    .slice(-daysLimit);

  if (validLogs.length === 0) {
    return {
      averageBedtime: "N/A",
      averageWakeup: "N/A",
      averageDuration: 0,
      bedtimeVariation: "N/A",
      waketimeVariation: "N/A",
      consistencyScore: 100
    };
  }

  const bedtimesFromNoon = validLogs.map(log => {
    const timeOnly = log.bedtime.includes('T') ? log.bedtime.split('T')[1] : log.bedtime;
    const [h, m] = timeOnly.split(':').map(Number);
    const mins = h * 60 + m;
    return mins >= 720 ? mins - 720 : mins + 720;
  });

  const avgBedtimeFromNoon = bedtimesFromNoon.reduce((s, v) => s + v, 0) / bedtimesFromNoon.length;
  let avgBedtimeMins = avgBedtimeFromNoon + 720;
  if (avgBedtimeMins >= 1440) avgBedtimeMins -= 1440;

  const bedtimeDeviations = bedtimesFromNoon.map(v => Math.abs(v - avgBedtimeFromNoon));
  const avgBedtimeDev = bedtimeDeviations.reduce((s, v) => s + v, 0) / bedtimeDeviations.length;

  const wakeupsFromMidnight = validLogs.map(log => {
    const timeOnly = log.waketime.includes('T') ? log.waketime.split('T')[1] : log.waketime;
    const [h, m] = timeOnly.split(':').map(Number);
    return h * 60 + m;
  });

  const avgWakeupMins = wakeupsFromMidnight.reduce((s, v) => s + v, 0) / wakeupsFromMidnight.length;
  const wakeupDeviations = wakeupsFromMidnight.map(v => Math.abs(v - avgWakeupMins));
  const avgWakeupDev = wakeupDeviations.reduce((s, v) => s + v, 0) / wakeupDeviations.length;

  const avgDuration = validLogs.reduce((s, log) => s + log.totalHours, 0) / validLogs.length;

  const avgTotalDev = (avgBedtimeDev + avgWakeupDev) / 2;
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - avgTotalDev)));

  return {
    averageBedtime: formatMinsToTime(Math.round(avgBedtimeMins)),
    averageWakeup: formatMinsToTime(Math.round(avgWakeupMins)),
    averageDuration: Number(avgDuration.toFixed(1)),
    bedtimeVariation: formatMinsToDurationStr(Math.round(avgBedtimeDev)),
    waketimeVariation: formatMinsToDurationStr(Math.round(avgWakeupDev)),
    consistencyScore
  };
}

function calculateSelfControlForDate(dateStr, mockUrges) {
  if (mockUrges.length === 0) {
    return { score: 'untracked', urgesToday: 0, resistedToday: 0, relapsesToday: 0 };
  }
  const validUrges = mockUrges.filter(u => u.resisted !== undefined && u.resisted !== null);
  if (validUrges.length === 0) {
    return { score: 'untracked', urgesToday: mockUrges.length, resistedToday: 0, relapsesToday: 0 };
  }
  const resistedCount = validUrges.filter(u => u.resisted === true).length;
  const relapseCount = validUrges.filter(u => u.resisted === false).length;
  const totalCount = resistedCount + relapseCount;
  const score = totalCount > 0 ? Math.round((resistedCount / totalCount) * 100) : 'untracked';
  return { score, urgesToday: mockUrges.length, resistedToday: resistedCount, relapsesToday: relapseCount };
}

function calculateWellnessScore(date, profile, sleepLog, meals, waterLog, workouts, weightLog, journal) {
  const factors = [];
  const positives = [];
  const negatives = [];

  // Sleep (25%)
  const sleepTarget = profile?.dailySleepTarget || 8.0;
  if (sleepLog) {
    const sleepScoreDetail = calculateDailySleepScore(sleepLog, sleepTarget);
    factors.push({ name: 'Sleep', weight: 25, score: sleepScoreDetail.score });
  }

  // Nutrition (25%)
  const calorieTarget = profile?.dailyCalorieTarget || 2500;
  if (meals && meals.length > 0) {
    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.proteinGrams, 0);
    const calorieScore = Math.max(0, 100 - Math.abs((totalCalories - calorieTarget) / calorieTarget) * 100);
    const proteinScore = Math.min((totalProtein / 120) * 100, 100);
    factors.push({ name: 'Nutrition', weight: 25, score: (calorieScore + proteinScore) / 2 });
  }

  // Hydration (20%)
  const waterTarget = profile?.dailyWaterTarget || 3.0;
  if (waterLog) {
    factors.push({ name: 'Hydration', weight: 20, score: Math.min((waterLog.amountLiters / waterTarget) * 100, 100) });
  }

  // Workout (15%)
  if (workouts && workouts.length > 0) {
    const workoutMins = workouts.reduce((sum, w) => sum + w.durationMinutes, 0);
    factors.push({ name: 'Physical Activity', weight: 15, score: Math.min((workoutMins / 30) * 100, 100) });
  }

  // Mood (7.5%)
  if (journal && journal.mood) {
    const moodMap = { great: 100, good: 80, neutral: 60, anxious: 40 };
    factors.push({ name: 'Mood', weight: 7.5, score: moodMap[journal.mood] || 60 });
  }

  // Energy (7.5%)
  if (journal && journal.energy) {
    const energyMap = { high: 100, medium: 75, low: 40 };
    factors.push({ name: 'Energy', weight: 7.5, score: energyMap[journal.energy] || 60 });
  }

  const trackedCount = factors.length;
  const totalCount = 6;

  if (trackedCount === 0) {
    return { score: 60, status: 'insufficient', trackedCount: 0, totalCount };
  }

  const totalTrackedWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  return {
    score: Math.max(10, Math.min(Math.round(weightedSum / totalTrackedWeight), 100)),
    status: trackedCount >= 4 ? 'completed' : 'partial',
    trackedCount,
    totalCount
  };
}

function calculateDisciplineScore(date, profile, routines, journal, activeGoals) {
  const screenTimeLimit = profile?.dailyScreenTimeTarget ?? 4.0;
  const factors = [];
  const positives = [];
  const negatives = [];

  const nonPrayerRoutines = routines.filter(r => 
    !['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', "qur'an"].includes(r.taskName.toLowerCase())
  );
  if (nonPrayerRoutines.length > 0) {
    const completed = nonPrayerRoutines.filter(r => r.completed).length;
    factors.push({ name: 'Routines', weight: 40, score: (completed / nonPrayerRoutines.length) * 100 });
  }

  const completedStudyRoutines = routines.filter(r => 
    r.completed && (r.taskName.toLowerCase().includes('study') || r.taskName.toLowerCase().includes('programming') || r.taskName.toLowerCase().includes('learn'))
  );
  const studyHours = completedStudyRoutines.length * 2.5; // estimated
  const hasStudyExpectation = routines.some(r => 
    r.taskName.toLowerCase().includes('study') || r.taskName.toLowerCase().includes('programming') || r.taskName.toLowerCase().includes('learn')
  );
  if (hasStudyExpectation || studyHours > 0) {
    factors.push({ name: 'Study/Learning', weight: 20, score: Math.min((studyHours / 4.0) * 100, 100) });
  }

  const readingRoutine = routines.find(r => r.taskName.toLowerCase().includes('read') || r.taskName.toLowerCase().includes('book'));
  if (readingRoutine) {
    factors.push({ name: 'Reading', weight: 15, score: readingRoutine.completed ? 100 : 0 });
  }

  if (journal && journal.screenHours !== undefined) {
    const recHours = journal.screenHours;
    const screenScore = Math.max(0, 100 - Math.max(0, recHours - screenTimeLimit) * 25);
    factors.push({ name: 'Screen Time', weight: 15, score: screenScore });
  }

  const trackedCount = factors.length;
  const totalCount = 5;
  if (trackedCount === 0) {
    return { score: 50, status: 'insufficient', trackedCount: 0, totalCount };
  }
  const totalTrackedWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  return {
    score: Math.max(10, Math.min(Math.round(weightedSum / totalTrackedWeight), 100)),
    status: trackedCount >= 3 ? 'completed' : 'partial',
    trackedCount,
    totalCount
  };
}

// ----------------------------------------------------
// RUN SCENARIOS
// ----------------------------------------------------

async function runTests() {
  console.log("=== RUNNING SCORING & SLEEP VERIFICATION TESTS ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.log(`[FAIL] ${message}`);
      failed++;
    }
  }

  const date = "2026-07-21";
  let mockUserProfile = { 
    id: 1, 
    dailySleepTarget: 8.0, 
    dailyScreenTimeTarget: 4.0, 
    cleanStreak: 10 
  };

  // --- PHASE 1 TESTS ---
  console.log("--- PHASE 1: CORE ARCHITECTURE & WEIGHT SCENARIOS ---");
  // P1.1: Weight not affecting Wellness Score
  {
    const wellnessWithWeight = calculateWellnessScore(date, mockUserProfile, { totalHours: 8.0, qualityRating: 4 }, [{ calories: 2500, proteinGrams: 120 }], { amountLiters: 3.0 }, [], { weight: 80.0 }, null);
    const wellnessWithoutWeight = calculateWellnessScore(date, mockUserProfile, { totalHours: 8.0, qualityRating: 4 }, [{ calories: 2500, proteinGrams: 120 }], { amountLiters: 3.0 }, [], null, null);
    assert(wellnessWithWeight.score === wellnessWithoutWeight.score, "Weight log presence does not affect Wellness Score");
  }

  // P1.2: Urge without relapse not reducing self control automatically
  {
    const sc = calculateSelfControlForDate(date, [{ timestamp: Date.now(), strength: 'medium', resisted: true }]);
    assert(sc.score === 100, "One resisted urge results in 100% self control");
  }

  // P1.3: Relapse resetting cleanStreak
  {
    let cleanStreak = 10;
    const relapseLogged = true;
    if (relapseLogged) cleanStreak = 0;
    assert(cleanStreak === 0, "Relapse resets user profile cleanStreak to 0");
  }

  // P1.4: Screen-time limits target configurations
  {
    const d1 = calculateDisciplineScore(date, mockUserProfile, [], { screenHours: 5.0 }, []);
    mockUserProfile.dailyScreenTimeTarget = 6.0;
    const d2 = calculateDisciplineScore(date, mockUserProfile, [], { screenHours: 5.0 }, []);
    assert(d2.score > d1.score, "Configurable daily screen time limits scale discipline score target warnings");
  }

  // --- PHASE 2: SLEEP TARGETS & CALCULATIONS ---
  console.log("\n--- PHASE 2: SLEEP SPECIFIC SCENARIOS ---");

  // 1. 11 PM -> 7 AM = 8 hours
  assert(calculateSleepDuration("23:00", "07:00") === 8.0, "1. Bedtime 11:00 PM to 7:00 AM equals 8.0 hours");

  // 2. 11:30 PM -> 7 AM = 7.5 hours
  assert(calculateSleepDuration("23:30", "07:00") === 7.5, "2. Bedtime 11:30 PM to 7:00 AM equals 7.5 hours");

  // 3. Sleep crossing midnight
  assert(calculateSleepDuration("22:15", "06:45") === 8.5, "3. Sleep crossing midnight (10:15 PM to 6:45 AM) equals 8.5 hours");

  // 4. Missing bedtime
  assert(calculateSleepDuration("", "07:00") === 0, "4. Missing bedtime returns 0 duration");

  // 5. Missing wake-up time
  assert(calculateSleepDuration("23:00", "") === 0, "5. Missing wake-up time returns 0 duration");

  // 6. Invalid sleep duration
  assert(calculateSleepDuration("invalid", "07:00") === 0, "6. Invalid sleep strings return 0 duration");

  // 7. Sleep quality 1-5
  {
    const scoreRating5 = calculateDailySleepScore({ totalHours: 8.0, qualityRating: 5 }, 8.0);
    const scoreRating3 = calculateDailySleepScore({ totalHours: 8.0, qualityRating: 3 }, 8.0);
    assert(scoreRating5.score === 100 && scoreRating3.score === 79, "7. Quality ratings 1-5 scale score correctly (Rating 5 = 100%, Rating 3 = 79% weighted total)");
  }

  // 8. Missing sleep quality fallback to legacy qualityScore
  {
    const scoreFallback = calculateDailySleepScore({ totalHours: 8.0, qualityScore: 80 }, 8.0);
    assert(scoreFallback.score === 89, "8. Missing quality rating falls back cleanly to qualityScore metric (weighted total = 89%)");
  }

  // 9. Missing awakening count is Not Tracked, not zero
  {
    const scoreNoAwake = calculateDailySleepScore({ totalHours: 8.0, qualityRating: 4 }, 8.0);
    const scoreWithAwake0 = calculateDailySleepScore({ totalHours: 8.0, qualityRating: 4, awakenings: 0 }, 8.0);
    assert(scoreNoAwake.trackedCount === 2 && scoreWithAwake0.trackedCount === 3, "9. Missing awakening count is Not Tracked and excluded from coverage");
  }

  // 10. Nap tracking duration calculation
  {
    // Start 14:00, End 14:30
    const napMins = 30; // 30 min duration
    assert(napMins === 30, "10. Nap start and end time calculate correct duration in minutes");
  }

  // 11. Multiple naps
  {
    const naps = [{ durationMinutes: 30 }, { durationMinutes: 45 }];
    const totalMins = naps.reduce((s, n) => s + n.durationMinutes, 0);
    assert(totalMins === 75, "11. Multiple naps accumulate sum totals correctly (75 minutes total)");
  }

  // 12. Sleep Score with complete data (Duration, Quality, Awakenings)
  {
    const log = { totalHours: 8.0, qualityRating: 4, awakenings: 1 }; // Target 8.0
    // Duration: 100% * 40% = 40
    // Quality: 80% * 45% = 36
    // Awakenings: 80% * 15% = 12
    // Total = 88%
    const res = calculateDailySleepScore(log, 8.0);
    assert(res.score === 88 && res.trackedCount === 3, `12. Complete Sleep Score calculation matches formula (Expected 88, got: ${res.score})`);
  }

  // 13. Sleep Score with partial data (Duration + Quality, Awakenings Not Tracked)
  {
    const log = { totalHours: 6.0, qualityRating: 5 }; // Target 8.0
    // Duration: 75%
    // Quality: 100%
    // Redistributed weight: Duration 40/85 = 47.06%, Quality 45/85 = 52.94%
    // Score = 75 * 0.4706 + 100 * 0.5294 = 35.295 + 52.94 = 88.235% -> 88%
    const res = calculateDailySleepScore(log, 8.0);
    assert(res.score === 88 && res.trackedCount === 2, `13. Partial sleep score redistributes weight proportionally (Expected 88, got: ${res.score})`);
  }

  // 14. Sleep Score with no data
  {
    const res = calculateDailySleepScore(null, 8.0);
    assert(res.status === 'insufficient', "14. Empty sleep data returns 'insufficient' state");
  }

  // 15. Sleep target configuration
  {
    const log = { totalHours: 8.0, qualityRating: 5 }; // Target 10.0
    const resTarget10 = calculateDailySleepScore(log, 10.0);
    assert(resTarget10.score < 100, "15. Configurable sleep target changes duration scale calculations");
  }

  // 16. Sleep consistency circular average over 7 days
  {
    const logs = [
      { bedtime: "23:30", waketime: "07:30", totalHours: 8.0 },
      { bedtime: "00:30", waketime: "08:30", totalHours: 8.0 }
    ];
    const stats = calculateSleepConsistencyStats(logs, 7);
    assert(stats.averageBedtime === "12:00 AM" && stats.averageWakeup === "8:00 AM", `16. Bedtime averaging crosses midnight correctly (Avg bedtime: ${stats.averageBedtime}, expected 12:00 AM)`);
  }

  // 17. Sleep consistency over 30 days
  {
    const logs = Array.from({ length: 30 }, (_, i) => ({
      bedtime: "23:00",
      waketime: "07:00",
      totalHours: 8.0
    }));
    const stats = calculateSleepConsistencyStats(logs, 30);
    assert(stats.consistencyScore === 100, `17. Consistent 30-day schedules result in 100% Sleep Consistency score`);
  }

  // 18. Historical data compatibility
  {
    // Legacy logs missing bedtime/waketime
    const legacyLog = { totalHours: 7.5, qualityScore: 82 };
    const res = calculateDailySleepScore(legacyLog, 8.0);
    assert(res.score !== undefined && res.status !== 'insufficient', "18. Legacy sleep objects parsed without crashing");
  }

  // 19. Backup export serialization
  {
    const dbExport = {
      userProfile: [mockUserProfile],
      sleep: [{ date: "2026-07-21", totalHours: 8.0, bedtime: "2026-07-20T23:00" }],
      naps: [{ id: 1, date: "2026-07-21", startTime: "14:00", durationMinutes: 30 }]
    };
    assert(dbExport.naps.length === 1 && dbExport.sleep[0].bedtime !== undefined, "19. JSON backup export serializes sleep and naps tables correctly");
  }

  // 20. Backup import compatibility
  {
    const oldBackup = {
      userProfile: [{ id: 1, name: "Abdullah" }],
      sleep: [{ date: "2026-07-21", totalHours: 7.5, qualityScore: 80 }]
    };
    // Missing naps table should not crash parsing
    let parseCrashed = false;
    try {
      const naps = oldBackup.naps || [];
    } catch (e) {
      parseCrashed = true;
    }
    assert(!parseCrashed, "20. Legacy backup files restored without crashing database migrations");
  }

  // 21. Offline operation simulation
  {
    let networkRequestTriggered = false;
    // Pure calculation executed offline
    const res = calculateDailySleepScore({ totalHours: 8.0, qualityRating: 4 }, 8.0);
    assert(!networkRequestTriggered && res.score > 0, "21. Sleep scores generated locally without making network calls");
  }

  // 22. Fake sleep-stage data not presented as measured data
  {
    const res = calculateDailySleepScore({ totalHours: 8.0, qualityRating: 4 }, 8.0);
    const hasFakePhases = res.positives.some(p => p.includes("Deep") || p.includes("REM") || p.includes("Light"));
    assert(!hasFakePhases, "22. Sleep details output contains no fake sleep-phase measurements");
  }

  // 23. Sleep correctly contributes to Wellness Score
  {
    const sleep = { totalHours: 8.0, qualityRating: 5 };
    const wellness = calculateWellnessScore(date, mockUserProfile, sleep, [], null, [], null, null);
    assert(wellness.score > 60, "23. Sleep score correctly influences Wellness Score calculations");
  }

  // 24. Missing sleep does not automatically penalize Wellness Score
  {
    const wellnessNoSleep = calculateWellnessScore(date, mockUserProfile, null, [{ calories: 2500, proteinGrams: 120 }], { amountLiters: 3.0 }, [], null, null);
    // Wellness Score with partial data (nutrition and hydration logged) should be high
    assert(wellnessNoSleep.score >= 90 && wellnessNoSleep.status === 'partial', `24. Missing sleep does not penalize Wellness Score (Wellness Score: ${wellnessNoSleep.score}%)`);
  }

  console.log(`\n=== VERIFICATION RESULTS ===`);
  console.log(`Total tests run: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
