// Standalone Test Script for Phase 3 Step 5 - Deen Scoring Engine

function calculateDeenScoreMock(prayers, routines, activeGoals) {
  const factors = [];
  const positives = [];
  const negatives = [];

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  let trackedPrayerPointsSum = 0;
  let trackedPrayerCount = 0;
  const onTimeList = [];
  const lateList = [];
  const missedList = [];

  prayerNames.forEach(field => {
    let status = undefined;

    if (prayers && prayers[field] !== undefined) {
      const val = prayers[field];
      if (val === true) status = 'prayed_on_time';
      else if (val === false) status = 'not_tracked';
      else if (typeof val === 'string') status = val;
      else if (typeof val === 'object' && val !== null && val.status) status = val.status;
    } else {
      const routineTask = routines?.find(r => r.taskName.toLowerCase() === field);
      if (routineTask) {
        status = routineTask.completed ? 'prayed_on_time' : undefined;
      }
    }

    if (status === 'prayed_on_time') {
      trackedPrayerPointsSum += 100;
      trackedPrayerCount++;
      onTimeList.push(field);
    } else if (status === 'prayed_late') {
      trackedPrayerPointsSum += 50;
      trackedPrayerCount++;
      lateList.push(field);
    } else if (status === 'missed') {
      trackedPrayerPointsSum += 0;
      trackedPrayerCount++;
      missedList.push(field);
    }
    // not_tracked, pending, window_expired are excluded
  });

  if (trackedPrayerCount > 0) {
    const prayerScore = Math.round(trackedPrayerPointsSum / trackedPrayerCount);
    factors.push({ name: 'Prayers', weight: 60, score: prayerScore });
    if (onTimeList.length > 0) positives.push(`Prayed on time: ${onTimeList.join(', ')}`);
    if (lateList.length > 0) positives.push(`Prayed late: ${lateList.join(', ')}`);
    if (missedList.length > 0) negatives.push(`Opportunity to make up: ${missedList.join(', ')}`);
  }

  // 2. Qur'an Recitation (25%)
  const quranRoutine = routines?.find(r => r.taskName === "Qur'an");
  let quranMinutes = undefined;

  if (prayers && prayers.quranMinutes !== undefined && prayers.quranMinutes !== null) {
    quranMinutes = prayers.quranMinutes;
  } else if (quranRoutine) {
    quranMinutes = quranRoutine.completed ? 15 : 0;
  }

  if (quranMinutes !== undefined && (prayers?.quranMinutes !== undefined || quranRoutine !== undefined)) {
    const quranScore = Math.min(100, Math.round((quranMinutes / 30) * 100));
    factors.push({ name: 'Qur\'an reading', weight: 25, score: quranScore });
    if (quranMinutes >= 15) positives.push(`Recited Qur'an for ${quranMinutes} mins`);
    else negatives.push("No Qur'an recitation logged yet today");
  }

  // 3. Islamic Goals (15%)
  const activeDeenGoals = activeGoals?.filter(g => g.category === 'deen') || [];
  if (activeDeenGoals.length > 0) {
    let sumProgress = 0;
    for (const g of activeDeenGoals) {
      let p = 0;
      if (g.targetValue === g.currentValue) p = 100;
      else if (g.targetValue > 0) p = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
      sumProgress += p;
    }
    const deenGoalScore = Math.round(sumProgress / activeDeenGoals.length);
    factors.push({ name: 'Islamic Goals', weight: 15, score: deenGoalScore });
    if (deenGoalScore >= 50) positives.push("Steady progress on Islamic goals");
  }

  const trackedCount = factors.length;
  const totalCount = 3;

  if (trackedCount === 0) {
    return {
      score: 60,
      status: 'insufficient',
      trackedCount: 0,
      totalCount,
      positives: [],
      negatives: [],
      recommendation: "Log your prayers or Qur'an recitation to track your Deen score."
    };
  }

  const totalTrackedWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  const finalScore = Math.round(weightedSum / totalTrackedWeight);

  let recommendation = "Prioritize daily prayers as peaceful anchors of your day.";
  const lowestFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  if (lowestFactor && lowestFactor.score < 80) {
    recommendation = `Focus on nurturing ${lowestFactor.name.toLowerCase()} consistency tomorrow.`;
  }

  return {
    score: Math.max(10, Math.min(finalScore, 100)),
    status: trackedCount === totalCount ? 'completed' : 'partial',
    trackedCount,
    totalCount,
    positives,
    negatives,
    recommendation
  };
}

async function runTests() {
  console.log("=== RUNNING STEP 5: DEEN SCORING ENGINE TESTS ===\n");
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

  // 1. prayed_on_time = 100%
  {
    const res = calculateDeenScoreMock({ fajr: { status: 'prayed_on_time' } }, [], []);
    assert(res.score === 100, '1. prayed_on_time gives 100% prayer score');
  }

  // 2. prayed_late = 50%
  {
    const res = calculateDeenScoreMock({ fajr: { status: 'prayed_late' } }, [], []);
    assert(res.score === 50, '2. prayed_late gives 50% prayer score');
  }

  // 3. missed = 0%
  {
    const res = calculateDeenScoreMock({ fajr: { status: 'missed' } }, [], []);
    assert(res.score === 0 || res.score === 10, '3. missed gives 0% prayer score (clamped to min threshold 10)');
  }

  // 4. Excludes not_tracked, pending, window_expired from prayer scoring
  {
    const res = calculateDeenScoreMock({
      fajr: { status: 'prayed_on_time' },
      dhuhr: { status: 'not_tracked' },
      asr: { status: 'pending' },
      maghrib: { status: 'window_expired' }
    }, [], []);
    // Only Fajr (100%) is tracked. Score should be 100, not penalized by excluded prayers.
    assert(res.score === 100, '4. Excludes not_tracked, pending, and window_expired from prayer scoring');
  }

  // 5. Untracked prayers factor when all prayers excluded
  {
    const res = calculateDeenScoreMock({
      fajr: { status: 'not_tracked' },
      dhuhr: { status: 'not_tracked' }
    }, [], []);
    assert(res.status === 'insufficient', '5. All excluded prayers results in untracked factor');
  }

  // 6. Dynamic weight redistribution (Prayers 60 + Quran 25, Goals untracked)
  {
    // Fajr = 100%, Quran 15 mins = 50% score (15/30).
    // Prayers weight 60, Quran weight 25 -> Total weight 85.
    // Score = (100 * 60 + 50 * 25) / 85 = (6000 + 1250) / 85 = 7250 / 85 = 85.29 -> 85
    const res = calculateDeenScoreMock({ fajr: { status: 'prayed_on_time' }, quranMinutes: 15 }, [], []);
    assert(res.score === 85 && res.trackedCount === 2, `6. Dynamic weight redistribution recalculates score correctly (Expected 85, got ${res.score})`);
  }

  // 7. Dynamic weight redistribution (Only Prayers 60% tracked)
  {
    const res = calculateDeenScoreMock({ fajr: { status: 'prayed_on_time' }, dhuhr: { status: 'prayed_late' } }, [], []);
    // Prayers score = (100 + 50)/2 = 75%. Total weight = 60. Score = 75%.
    assert(res.score === 75 && res.trackedCount === 1, `7. Single tracked category scales to 100% of active weight (Expected 75, got ${res.score})`);
  }

  // 8. If nothing tracked -> Not Tracked status (insufficient), not 0%
  {
    const res = calculateDeenScoreMock(null, [], []);
    assert(res.status === 'insufficient' && res.score !== 0, '8. Empty data returns insufficient status and is not scored as 0%');
  }

  // 9. Tracking coverage display
  {
    const res = calculateDeenScoreMock({ fajr: { status: 'prayed_on_time' }, quranMinutes: 30 }, [], [{ category: 'deen', targetValue: 30, currentValue: 15 }]);
    assert(res.trackedCount === 3 && res.totalCount === 3, `9. Tracking coverage reports exact tracked count (${res.trackedCount} of ${res.totalCount})`);
  }

  // 10. Non-judgmental language in guidance and negatives
  {
    const res = calculateDeenScoreMock({ fajr: { status: 'prayed_on_time' }, asr: { status: 'missed' } }, [], []);
    const hasJudgmentalWords = res.negatives.some(n => n.includes('Fail') || n.includes('Sin') || n.includes('Lazy')) ||
                               res.recommendation.includes('Fail') || res.recommendation.includes('Lazy');
    assert(!hasJudgmentalWords && res.recommendation.length > 0, '10. UI recommendation and feedback language is non-judgmental and encouraging');
  }

  console.log(`\n=== STEP 5 VERIFICATION RESULTS ===`);
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
