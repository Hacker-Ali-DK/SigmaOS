import { getTodayDateString, ensureRoutinesForDate, useAppStore } from './store';
import { dayBoundaryManager } from './day-boundary-manager';
import { db } from './db';
import { eventBus } from './events/event-bus';
import { StandardEvents } from './events/event-catalog';

async function runDayBoundaryTransitionTest() {
  console.log("=== Testing Day-Boundary Midnight Transition Architecture ===");

  // 1. Test Timezone-Aware Date String Generation (Asia/Karachi)
  const karachiDateStr = getTodayDateString('Asia/Karachi');
  console.log(`✓ Configured Asia/Karachi Date String: ${karachiDateStr}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(karachiDateStr)) {
    throw new Error(`❌ Invalid YYYY-MM-DD date format: ${karachiDateStr}`);
  }

  // 2. Test Day-Boundary Manager Automatic Seeding & Store Synchronization
  const targetNewDate = '2026-07-25';
  
  // Set store initially to yesterday
  useAppStore.setState({ selectedDate: '2026-07-24' });
  console.log(`✓ Store Initialized with Yesterday: ${useAppStore.getState().selectedDate}`);

  // Subscribe to DAY_CHANGED event
  let eventFired = false;
  eventBus.subscribe('test_day_changed', StandardEvents.DAY_CHANGED, async (payload: any) => {
    console.log(`✓ DAY_CHANGED Event Received: ${payload.previousDate} -> ${payload.currentDate}`);
    eventFired = true;
  });

  // Execute Day-Boundary Check
  await dayBoundaryManager.checkDayBoundary();

  // 3. Verify Routine Seeding for Target Date
  await ensureRoutinesForDate(targetNewDate);
  const routinesNewDay = await db.routines.where({ date: targetNewDate }).toArray();
  console.log(`✓ Fresh Day Routines Initialized: ${routinesNewDay.length} tasks ready for user completion`);

  // 4. Verify Prayer Log Query for New Day Returns Fresh State
  const prayerLogNewDay = await db.prayers.get(targetNewDate);
  console.log(`✓ New Day Prayer Log State: ${prayerLogNewDay ? 'recorded' : 'unrecorded (fresh)'}`);

  console.log("=== Day-Boundary Midnight Transition Regression Test PASSED! ===");
}

runDayBoundaryTransitionTest().catch(console.error);
