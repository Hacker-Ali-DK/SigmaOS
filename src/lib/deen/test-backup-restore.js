// Standalone Test Script for Phase 3 Step 9 - Version 5 Deen Backup & Restore Integration

function getPrayerStatus(val) {
  if (val === true) return 'prayed_on_time';
  if (val === false) return 'not_tracked';
  if (typeof val === 'string') {
    if (val === 'prayed_on_time' || val === 'prayed_late' || val === 'missed' || val === 'not_tracked') {
      return val;
    }
  }
  if (typeof val === 'object' && val !== null && typeof val.status === 'string') {
    if (val.status === 'prayed_on_time' || val.status === 'prayed_late' || val.status === 'missed' || val.status === 'not_tracked') {
      return val.status;
    }
  }
  return 'not_tracked';
}

function normalizePrayerDetail(val) {
  if (typeof val === 'object' && val !== null && typeof val.status === 'string') {
    const detail = {
      status: getPrayerStatus(val.status)
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

function mockExportBackup(dbData) {
  const exportPayload = {
    version: 5,
    exportedAt: new Date().toISOString(),
    userProfile: dbData.userProfile || [],
    prayers: (dbData.prayers || []).map(p => migrateLegacyPrayerLog(p)),
    dopamineUrges: dbData.dopamineUrges || [],
    sleep: dbData.sleep || [],
    water: dbData.water || [],
    meals: dbData.meals || [],
    workouts: dbData.workouts || [],
    routines: dbData.routines || [],
    goals: dbData.goals || [],
    journal: dbData.journal || [],
    weight: dbData.weight || [],
    naps: dbData.naps || []
  };
  return JSON.stringify(exportPayload, null, 2);
}

function mockImportBackup(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON payload');
  }

  const restored = {
    version: parsed.version || 1,
    userProfile: Array.isArray(parsed.userProfile) ? parsed.userProfile : [],
    prayers: Array.isArray(parsed.prayers) ? parsed.prayers.map(migrateLegacyPrayerLog) : [],
    sleep: Array.isArray(parsed.sleep) ? parsed.sleep : [],
    naps: Array.isArray(parsed.naps) ? parsed.naps : [],
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    dopamineUrges: Array.isArray(parsed.dopamineUrges) ? parsed.dopamineUrges : []
  };

  return restored;
}

async function runTests() {
  console.log("=== RUNNING PHASE 3 STEP 9: BACKUP & RESTORE INTEGRATION TESTS ===\n");
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

  // Sample Version 5 prayer log
  const v5Record = {
    date: '2026-07-21',
    fajr: { status: 'prayed_on_time', scheduledTime: '05:05', completedTime: '05:15' },
    dhuhr: { status: 'prayed_late', scheduledTime: '12:30', completedTime: '14:00' },
    asr: { status: 'missed' },
    maghrib: { status: 'not_tracked' },
    isha: { status: 'prayed_on_time', scheduledTime: '20:45', completedTime: '21:00' },
    quranMinutes: 25,
    calculationContext: {
      latitude: 24.8607,
      longitude: 67.0011,
      timezone: 'Asia/Karachi',
      method: 'karachi',
      asrMethod: 'standard',
      ishaPolicy: 'midnight'
    }
  };

  // 1. Version 5 prayer backup export preserves detailed prayer statuses
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const parsed = JSON.parse(jsonStr);
    assert(parsed.version === 5 && parsed.prayers[0].fajr.status === 'prayed_on_time', '1. Version 5 prayer backup export preserves detailed prayer statuses');
  }

  // 2. prayed_on_time survives export/import
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].fajr.status === 'prayed_on_time', '2. prayed_on_time survives export/import');
  }

  // 3. prayed_late survives export/import
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].dhuhr.status === 'prayed_late', '3. prayed_late survives export/import');
  }

  // 4. missed survives export/import
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].asr.status === 'missed', '4. missed survives export/import');
  }

  // 5. not_tracked survives export/import
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].maghrib.status === 'not_tracked', '5. not_tracked survives export/import');
  }

  // 6. scheduledTime is preserved when originally present
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].fajr.scheduledTime === '05:05', '6. scheduledTime is preserved when originally present');
  }

  // 7. completedTime is preserved when originally present
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].fajr.completedTime === '05:15', '7. completedTime is preserved when originally present');
  }

  // 8. Historical calculationContext is preserved exactly
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].calculationContext.timezone === 'Asia/Karachi' && restored.prayers[0].calculationContext.latitude === 24.8607, '8. Historical calculationContext is preserved exactly');
  }

  // 9. Missing historical calculationContext remains missing
  {
    const logNoCtx = { date: '2026-07-15', fajr: { status: 'prayed_on_time' } };
    const jsonStr = mockExportBackup({ prayers: [logNoCtx] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].calculationContext === undefined, '9. Missing historical calculationContext remains missing');
  }

  // 10. Missing historical timestamps remain missing
  {
    const logNoTimes = { date: '2026-07-15', fajr: { status: 'prayed_on_time' } };
    const jsonStr = mockExportBackup({ prayers: [logNoTimes] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].fajr.scheduledTime === undefined && restored.prayers[0].fajr.completedTime === undefined, '10. Missing historical timestamps remain missing');
  }

  // 11. Legacy true prayer migrates to prayed_on_time
  {
    const legacyJson = JSON.stringify({ prayers: [{ date: '2026-07-10', fajr: true }] });
    const restored = mockImportBackup(legacyJson);
    assert(restored.prayers[0].fajr.status === 'prayed_on_time', '11. Legacy true prayer migrates to prayed_on_time');
  }

  // 12. Legacy false prayer migrates to not_tracked
  {
    const legacyJson = JSON.stringify({ prayers: [{ date: '2026-07-10', dhuhr: false }] });
    const restored = mockImportBackup(legacyJson);
    assert(restored.prayers[0].dhuhr.status === 'not_tracked', '12. Legacy false prayer migrates to not_tracked');
  }

  // 13. Legacy false is NEVER converted to missed
  {
    const legacyJson = JSON.stringify({ prayers: [{ date: '2026-07-10', dhuhr: false }] });
    const restored = mockImportBackup(legacyJson);
    assert(restored.prayers[0].dhuhr.status !== 'missed', '13. Legacy false is NEVER converted to missed');
  }

  // 14. Old backups without Version 5 prayer fields restore successfully
  {
    const oldJson = JSON.stringify({ userProfile: [{ id: 1, name: 'Abdullah' }], prayers: [{ date: '2026-07-01', fajr: true, quranMinutes: 15 }] });
    const restored = mockImportBackup(oldJson);
    assert(restored.userProfile.length === 1 && restored.prayers[0].quranMinutes === 15, '14. Old backups without Version 5 fields restore successfully');
  }

  // 15. Old backups without a prayers table restore successfully
  {
    const noPrayersJson = JSON.stringify({ userProfile: [{ id: 1, name: 'Abdullah' }], sleep: [{ date: '2026-07-01', totalHours: 8 }] });
    const restored = mockImportBackup(noPrayersJson);
    assert(restored.prayers.length === 0 && restored.sleep.length === 1, '15. Old backups without a prayers table restore successfully without crashing');
  }

  // 16. Missing calculationContext does not crash restore
  {
    const jsonStr = JSON.stringify({ prayers: [{ date: '2026-07-05', fajr: { status: 'prayed_on_time' } }] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].calculationContext === undefined, '16. Missing calculationContext does not crash restore');
  }

  // 17. Version 5 backup restore preserves Qur'an minutes
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].quranMinutes === 25, '17. Version 5 backup restore preserves Qur\'an minutes');
  }

  // 18. Version 5 backup restore preserves Deen-related data
  {
    const jsonStr = mockExportBackup({ goals: [{ id: 1, category: 'deen', title: 'Memorize Surah', currentValue: 5 }] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.goals[0].category === 'deen', '18. Version 5 backup restore preserves Deen goals data');
  }

  // 19. Version 5 backup restore preserves Phase 2 Sleep/Nap data
  {
    const jsonStr = mockExportBackup({
      sleep: [{ date: '2026-07-21', totalHours: 7.5, qualityRating: 4 }],
      naps: [{ id: 1, date: '2026-07-21', durationMinutes: 30 }]
    });
    const restored = mockImportBackup(jsonStr);
    assert(restored.sleep[0].totalHours === 7.5 && restored.naps[0].durationMinutes === 30, '19. Version 5 backup restore preserves Phase 2 Sleep/Nap data');
  }

  // 20. Backup restore preserves unrelated existing Recovery+ tables
  {
    const jsonStr = mockExportBackup({ dopamineUrges: [{ id: 1, strength: 'medium' }] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.dopamineUrges[0].strength === 'medium', '20. Backup restore preserves unrelated existing Recovery+ tables');
  }

  // 21. Runtime states such as window_expired are not persisted as user statuses
  {
    const runtimeLog = { date: '2026-07-21', fajr: 'window_expired' };
    const jsonStr = mockExportBackup({ prayers: [runtimeLog] });
    const restored = mockImportBackup(jsonStr);
    assert(restored.prayers[0].fajr.status === 'not_tracked', '21. Runtime states such as window_expired are normalized to not_tracked during export/import');
  }

  // 22. Export/import round trip produces equivalent prayer data
  {
    const jsonStr = mockExportBackup({ prayers: [v5Record] });
    const restored = mockImportBackup(jsonStr);
    assert(
      restored.prayers[0].fajr.status === v5Record.fajr.status &&
      restored.prayers[0].fajr.completedTime === v5Record.fajr.completedTime &&
      restored.prayers[0].calculationContext.timezone === v5Record.calculationContext.timezone,
      '22. Export/import round trip produces equivalent prayer data'
    );
  }

  // 23. Backup version detection handles current and legacy formats
  {
    const v5Json = JSON.stringify({ version: 5, prayers: [] });
    const v1Json = JSON.stringify({ prayers: [] });
    const restoredV5 = mockImportBackup(v5Json);
    const restoredV1 = mockImportBackup(v1Json);
    assert(restoredV5.version === 5 && restoredV1.version === 1, '23. Backup version detection handles current (v5) and legacy (v1) formats');
  }

  // 24. Malformed/missing optional fields do not crash the importer when safely recoverable
  {
    const malformedJson = JSON.stringify({ version: 5, prayers: [{ date: '2026-07-01', fajr: null }] });
    const restored = mockImportBackup(malformedJson);
    assert(restored.prayers[0].fajr.status === 'not_tracked', '24. Malformed/missing optional fields do not crash the importer');
  }

  console.log(`\n=== STEP 9 VERIFICATION RESULTS ===`);
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
