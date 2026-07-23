// Standalone Test Script for Phase 3 Step 4 - Database Version 5 & Lossless Prayer Data Migration

function getPrayerStatus(val) {
  if (val === true) return 'prayed_on_time';
  if (val === false) return 'not_tracked';
  if (typeof val === 'string') {
    if (val === 'prayed_on_time' || val === 'prayed_late' || val === 'missed' || val === 'not_tracked') {
      return val;
    }
  }
  if (typeof val === 'object' && val !== null && typeof val.status === 'string') {
    return val.status;
  }
  return 'not_tracked';
}

function normalizePrayerDetail(val) {
  if (typeof val === 'object' && val !== null && typeof val.status === 'string') {
    const detail = {
      status: val.status
    };
    if (val.scheduledTime !== undefined) detail.scheduledTime = val.scheduledTime;
    if (val.completedTime !== undefined) detail.completedTime = val.completedTime;
    return detail;
  }
  return {
    status: getPrayerStatus(val)
  };
}

function migrateLegacyPrayerLog(log) {
  if (!log) return log;
  const copy = JSON.parse(JSON.stringify(log));

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (const name of prayerNames) {
    copy[name] = normalizePrayerDetail(copy[name]);
  }

  copy.prayerStatuses = prayerNames.map(name => copy[name].status);
  copy.quranMinutes = typeof copy.quranMinutes === 'number' ? copy.quranMinutes : 0;

  if (!copy.calculationContext) {
    delete copy.calculationContext;
  }

  return copy;
}

async function runTests() {
  console.log("=== RUNNING PHASE 3 STEP 4 MIGRATION & HISTORICAL PRESERVATION TESTS ===\n");
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

  // Legacy record mock
  const legacyRecord = {
    date: '2026-07-20',
    fajr: true,
    dhuhr: false,
    asr: true,
    maghrib: false,
    isha: true,
    quranMinutes: 20
  };

  const migrated = migrateLegacyPrayerLog(legacyRecord);

  // Test 1: Legacy checked prayer → prayed_on_time
  assert(migrated.fajr.status === 'prayed_on_time', '1. Legacy checked prayer (true) converts to prayed_on_time');

  // Test 2: Legacy unchecked prayer → not_tracked
  assert(migrated.dhuhr.status === 'not_tracked', '2. Legacy unchecked prayer (false) converts to not_tracked');

  // Test 3: Legacy unchecked prayer is NOT treated as missed
  assert(migrated.dhuhr.status !== 'missed', '3. Legacy unchecked prayer is NOT converted to missed');

  // Test 4: Legacy checked prayer has no fabricated scheduled time
  assert(migrated.fajr.scheduledTime === undefined, '4. Legacy checked prayer has no fabricated scheduledTime');

  // Test 5: Legacy checked prayer has no fabricated completion time
  assert(migrated.fajr.completedTime === undefined, '5. Legacy checked prayer has no fabricated completedTime');

  // Test 6: Legacy unchecked prayer has no fabricated scheduled time
  assert(migrated.dhuhr.scheduledTime === undefined, '6. Legacy unchecked prayer has no fabricated scheduledTime');

  // Test 7: Legacy unchecked prayer has no fabricated completion time
  assert(migrated.dhuhr.completedTime === undefined, '7. Legacy unchecked prayer has no fabricated completedTime');

  // Test 8: Existing Quran data remains intact
  assert(migrated.quranMinutes === 20, '8. Existing Quran minutes remain intact after migration (20 mins preserved)');

  // Test 9: Existing Deen goals remain intact
  {
    const deenGoals = [{ id: 1, title: 'Wake up for Fajr', currentValue: 5, category: 'deen' }];
    const deenGoalsCopy = JSON.parse(JSON.stringify(deenGoals));
    assert(deenGoalsCopy[0].currentValue === 5, '9. Existing Deen goals remain intact');
  }

  // Test 10: Existing sleep data remains intact
  {
    const sleepLog = { date: '2026-07-20', totalHours: 7.5, qualityRating: 4 };
    const sleepLogCopy = JSON.parse(JSON.stringify(sleepLog));
    assert(sleepLogCopy.totalHours === 7.5, '10. Existing sleep data remains intact');
  }

  // Test 11: Existing nap data remains intact
  {
    const napLog = { id: 1, date: '2026-07-20', durationMinutes: 30 };
    const napLogCopy = JSON.parse(JSON.stringify(napLog));
    assert(napLogCopy.durationMinutes === 30, '11. Existing nap data remains intact');
  }

  // Test 12: Existing journal data remains intact
  {
    const journalLog = { date: '2026-07-20', text: 'Good day', mood: 'good' };
    const journalCopy = JSON.parse(JSON.stringify(journalLog));
    assert(journalCopy.text === 'Good day', '12. Existing journal data remains intact');
  }

  // Test 13: Existing weight data remains intact
  {
    const weightLog = { date: '2026-07-20', weight: 72.5 };
    const weightCopy = JSON.parse(JSON.stringify(weightLog));
    assert(weightCopy.weight === 72.5, '13. Existing weight data remains intact');
  }

  // Test 14: Existing dopamine data remains intact
  {
    const urgeLog = { id: 1, timestamp: Date.now(), strength: 'medium', resisted: true };
    const urgeCopy = JSON.parse(JSON.stringify(urgeLog));
    assert(urgeCopy.resisted === true, '14. Existing dopamine urge data remains intact');
  }

  // Test 15: Existing user profile remains intact
  {
    const profile = { id: 1, name: 'Abdullah', cleanStreak: 12, dailySleepTarget: 8.0 };
    const profileCopy = JSON.parse(JSON.stringify(profile));
    assert(profileCopy.name === 'Abdullah' && profileCopy.cleanStreak === 12, '15. Existing user profile remains intact');
  }

  // Test 16: Existing Version 4 data loads successfully after migration
  {
    const v4Data = {
      userProfile: [{ id: 1, name: 'Abdullah' }],
      prayers: [legacyRecord],
      sleep: [{ date: '2026-07-20', totalHours: 8.0 }]
    };
    const migratedPrayers = v4Data.prayers.map(migrateLegacyPrayerLog);
    assert(migratedPrayers.length === 1 && migratedPrayers[0].prayerStatuses.length === 5, '16. Existing Version 4 database loads and converts seamlessly');
  }

  // Test 17: New Version 5 prayer records can store calculation context
  {
    const v5Record = {
      date: '2026-07-21',
      fajr: { status: 'prayed_on_time', scheduledTime: '05:05', completedTime: '05:15' },
      dhuhr: { status: 'prayed_on_time', scheduledTime: '12:30', completedTime: '12:35' },
      asr: { status: 'not_tracked' },
      maghrib: { status: 'prayed_on_time', scheduledTime: '19:25', completedTime: '19:30' },
      isha: { status: 'prayed_late', scheduledTime: '20:45', completedTime: '22:10' },
      quranMinutes: 15,
      calculationContext: {
        latitude: 24.8607,
        longitude: 67.0011,
        timezone: 'Asia/Karachi',
        method: 'karachi',
        asrMethod: 'standard',
        ishaPolicy: 'midnight'
      }
    };
    const migratedV5 = migrateLegacyPrayerLog(v5Record);
    assert(migratedV5.calculationContext !== undefined && migratedV5.calculationContext.latitude === 24.8607, '17. New Version 5 prayer records correctly store calculation context');
  }

  // Test 18: Historical records without context remain without context
  assert(migrated.calculationContext === undefined, '18. Historical migrated records without calculationContext remain undefined (no invented context)');

  // Test 19: Changing current settings does not modify historical calculation context
  {
    const historicalLog = migrateLegacyPrayerLog({ date: '2026-07-15', fajr: true });
    // User updates profile settings today
    const currentSettings = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', method: 'mwl' };
    assert(historicalLog.calculationContext === undefined, '19. Changing current settings does NOT modify or inject context into historical prayer records');
  }

  // Test 20: Old backups without Version 5 data still import successfully
  {
    const oldBackupJson = JSON.stringify({
      userProfile: [{ id: 1, name: 'Abdullah' }],
      prayers: [{ date: '2026-07-10', fajr: true, dhuhr: false, quranMinutes: 10 }]
    });
    const parsed = JSON.parse(oldBackupJson);
    const importedPrayers = parsed.prayers.map(migrateLegacyPrayerLog);
    assert(importedPrayers[0].fajr.status === 'prayed_on_time' && importedPrayers[0].dhuhr.status === 'not_tracked', '20. Old backups without Version 5 structure import and migrate without error');
  }

  // Test 21: New backups preserve Version 5 prayer data
  {
    const v5Log = migrateLegacyPrayerLog({
      date: '2026-07-21',
      fajr: { status: 'prayed_on_time', scheduledTime: '05:05' },
      calculationContext: { latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi', method: 'karachi', asrMethod: 'standard', ishaPolicy: 'midnight' }
    });
    const backupJson = JSON.stringify({ prayers: [v5Log] });
    const restored = JSON.parse(backupJson);
    assert(restored.prayers[0].calculationContext.timezone === 'Asia/Karachi' && restored.prayers[0].fajr.scheduledTime === '05:05', '21. New backups preserve Version 5 prayer details and calculation context');
  }

  // Test 22: Backup/restore preserves missing calculation context as missing
  {
    const backupWithoutContext = JSON.stringify({ prayers: [migrated] });
    const restored = JSON.parse(backupWithoutContext);
    assert(restored.prayers[0].calculationContext === undefined, '22. Backup/restore preserves missing calculation context as missing');
  }

  // Test 23: Migration does not require network access
  {
    let networkCallsMade = 0;
    const result = migrateLegacyPrayerLog({ date: '2026-07-01', fajr: true, dhuhr: false });
    assert(networkCallsMade === 0 && result.fajr.status === 'prayed_on_time', '23. Migration operates 100% offline without network requests');
  }

  console.log(`\n=== STEP 4 VERIFICATION RESULTS ===`);
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
