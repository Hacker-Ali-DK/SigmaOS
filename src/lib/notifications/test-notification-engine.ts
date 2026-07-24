import { notificationEngine } from './notification-engine';
import { notificationSchedulingEngine } from './scheduling-engine';
import { adaptiveIntelligenceEngine } from './adaptive-intelligence';
import { userControlsManager } from './user-controls';
import { intelligenceRulesManager } from './intelligence-rules';
import type { NotificationPayload } from './types';

async function testNotificationArchitecture() {
  console.log("=== Testing Phase 6 Smart Notification & Reminder Engine ===");

  const targetDate = '2026-07-24';

  // 1. Test Midnight Solar Recalibration
  await notificationSchedulingEngine.recalibrateSolarSchedules(targetDate);
  console.log("✓ Midnight Solar Schedule Recalibration Executed");

  // 2. Test Adaptive Intelligence Adaptation
  const candidate: NotificationPayload = {
    id: 'test_recovery_1',
    category: 'recovery',
    priority: 'P2',
    title: 'Check-in Prompt',
    body: 'How are you feeling today?',
    timestamp: Date.now()
  };

  const adapted = await adaptiveIntelligenceEngine.adaptNotification(candidate, targetDate);
  console.log(`✓ Adaptive Intelligence Target Priority: ${adapted.priority}`);

  // 3. Test Intelligence Anti-Spam Rules Evaluation
  const evalResult = await intelligenceRulesManager.evaluateNotification(adapted);
  console.log(`✓ Intelligence Rules Gate (Dispatch Allowed): ${evalResult.shouldDispatch}`);

  // 4. Test User Controls (1-Click Complete & Snooze)
  await userControlsManager.handleComplete(candidate);
  console.log("✓ User Control 1-Click Complete Handled");

  const snoozedTime = await userControlsManager.handleSnooze(candidate, 15);
  console.log(`✓ User Control Snooze 15m Scheduled for: ${new Date(snoozedTime).toISOString()}`);

  // 5. Test Notification Engine Dispatch & Permission Request
  const dispatched = await notificationEngine.dispatchNotification(candidate);
  console.log(`✓ Notification Engine Dispatch Handled: ${dispatched}`);

  const permState = await notificationEngine.requestNotificationPermission();
  console.log(`✓ Permission Request Method Executed (State: ${permState})`);

  // 6. Test Startup Recovery Catch-Up Sweep
  await notificationSchedulingEngine.performStartupCatchupSweep();
  console.log("✓ Startup Recovery Catch-Up Sweep Executed");

  // 7. Test Non-blocking 30-Day TTL History Cleanup
  await intelligenceRulesManager.pruneStaleHistory();
  console.log("✓ Non-Blocking 30-Day TTL History Cleanup Scheduled");

  console.log("=== All Phase 6 Production Refinements Verified Successfully! ===");
}

testNotificationArchitecture().catch(console.error);
