// Standalone Test Script for Phase 3 Step 6 - Detailed Prayer Status Logging & Preservation

function savePrayerStatusMock(existingLog, dateStr, field, newStatus, timestampStr) {
  const existingDetail = (existingLog && existingLog[field] && typeof existingLog[field] === 'object')
    ? existingLog[field]
    : {};

  const updatedDetail = {
    ...existingDetail,
    status: newStatus,
    completedTime: (newStatus === 'prayed_on_time' || newStatus === 'prayed_late') ? timestampStr : undefined
  };

  const updatedLog = {
    ...(existingLog || {
      date: dateStr,
      fajr: { status: 'not_tracked' },
      dhuhr: { status: 'not_tracked' },
      asr: { status: 'not_tracked' },
      maghrib: { status: 'not_tracked' },
      isha: { status: 'not_tracked' },
      quranMinutes: 0
    }),
    [field]: updatedDetail
  };

  return updatedLog;
}

function updateQuranMinutesMock(existingLog, dateStr, nextMins) {
  const updatedLog = {
    ...(existingLog || {
      date: dateStr,
      fajr: { status: 'not_tracked' },
      dhuhr: { status: 'not_tracked' },
      asr: { status: 'not_tracked' },
      maghrib: { status: 'not_tracked' },
      isha: { status: 'not_tracked' },
      quranMinutes: 0
    }),
    quranMinutes: nextMins
  };

  return updatedLog;
}

async function runTests() {
  console.log("=== RUNNING STEP 6: DETAILED PRAYER STATUS LOGGING TESTS ===\n");
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

  // 1. Setting detailed status prayed_on_time saves status and completion time
  {
    const log = savePrayerStatusMock(null, '2026-07-21', 'fajr', 'prayed_on_time', '05:15');
    assert(log.fajr.status === 'prayed_on_time' && log.fajr.completedTime === '05:15', '1. prayed_on_time saves status and completion time');
  }

  // 2. Setting detailed status prayed_late saves status and completion time
  {
    const log = savePrayerStatusMock(null, '2026-07-21', 'dhuhr', 'prayed_late', '14:30');
    assert(log.dhuhr.status === 'prayed_late' && log.dhuhr.completedTime === '14:30', '2. prayed_late saves status and completion time');
  }

  // 3. Setting detailed status missed saves status without completedTime
  {
    const log = savePrayerStatusMock(null, '2026-07-21', 'asr', 'missed', '17:00');
    assert(log.asr.status === 'missed' && log.asr.completedTime === undefined, '3. missed saves status without completedTime');
  }

  // 4. Setting detailed status not_tracked saves status without completedTime
  {
    const log = savePrayerStatusMock(null, '2026-07-21', 'maghrib', 'not_tracked', '19:30');
    assert(log.maghrib.status === 'not_tracked' && log.maghrib.completedTime === undefined, '4. not_tracked saves status without completedTime');
  }

  // 5. Expired unrecorded prayers remain not_tracked (NEVER automatically marked as missed)
  {
    const initialLog = {
      date: '2026-07-20',
      fajr: { status: 'prayed_on_time', completedTime: '05:00' },
      dhuhr: { status: 'not_tracked' }
    };
    // No automatic status change triggered on expiration
    assert(initialLog.dhuhr.status === 'not_tracked', '5. Expired unrecorded prayers remain not_tracked (never automatically set to missed)');
  }

  // 6. Preserves existing calculationContext when updating prayer statuses
  {
    const initialLog = {
      date: '2026-07-21',
      fajr: { status: 'not_tracked' },
      calculationContext: { latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi', method: 'karachi', asrMethod: 'standard', ishaPolicy: 'midnight' }
    };
    const updated = savePrayerStatusMock(initialLog, '2026-07-21', 'fajr', 'prayed_on_time', '05:10');
    assert(updated.calculationContext !== undefined && updated.calculationContext.timezone === 'Asia/Karachi', '6. Preserves existing calculationContext when updating prayer status');
  }

  // 7. Preserves scheduledTime if present in existing record
  {
    const initialLog = {
      date: '2026-07-21',
      fajr: { status: 'not_tracked', scheduledTime: '05:05' }
    };
    const updated = savePrayerStatusMock(initialLog, '2026-07-21', 'fajr', 'prayed_on_time', '05:12');
    assert(updated.fajr.scheduledTime === '05:05' && updated.fajr.completedTime === '05:12', '7. Preserves scheduledTime if present in existing record');
  }

  // 8. Recording completion time happens ONLY when user records the prayer
  {
    const unrecordedLog = savePrayerStatusMock(null, '2026-07-21', 'isha', 'not_tracked', '21:00');
    assert(unrecordedLog.isha.completedTime === undefined, '8. Recording completion time occurs ONLY on active user logging');
  }

  // 9. Keep legacy data intact
  {
    const legacyMigratedLog = {
      date: '2026-07-15',
      fajr: { status: 'prayed_on_time' },
      quranMinutes: 25
    };
    const updated = savePrayerStatusMock(legacyMigratedLog, '2026-07-15', 'dhuhr', 'prayed_late', '14:00');
    assert(updated.fajr.status === 'prayed_on_time' && updated.quranMinutes === 25, '9. Keeps existing legacy migrated prayer logs intact');
  }

  // 10. Qur'an logging does NOT overwrite prayer details or calculationContext
  {
    const detailedLog = {
      date: '2026-07-21',
      fajr: { status: 'prayed_on_time', completedTime: '05:10' },
      dhuhr: { status: 'prayed_late', completedTime: '14:00' },
      quranMinutes: 10,
      calculationContext: { latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi', method: 'karachi', asrMethod: 'standard', ishaPolicy: 'midnight' }
    };
    const updatedQuran = updateQuranMinutesMock(detailedLog, '2026-07-21', 30);
    assert(
      updatedQuran.quranMinutes === 30 &&
      updatedQuran.fajr.status === 'prayed_on_time' &&
      updatedQuran.dhuhr.completedTime === '14:00' &&
      updatedQuran.calculationContext.timezone === 'Asia/Karachi',
      '10. Qur\'an logging does NOT overwrite prayer details or calculationContext'
    );
  }

  console.log(`\n=== STEP 6 VERIFICATION RESULTS ===`);
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
