import { intelligenceRulesManager } from './intelligence-rules';
import { adaptiveIntelligenceEngine } from './adaptive-intelligence';
import { userControlsManager } from './user-controls';
import { notificationSchedulingEngine } from './scheduling-engine';
import { eventBus } from '@/lib/events/event-bus';
import { StandardEvents } from '@/lib/events/event-catalog';
import { getTodayDateString } from '@/lib/store';
import type { NotificationPayload, NotificationSink } from './types';

class NotificationEngineImpl {
  private sinks: NotificationSink[] = [];

  constructor() {
    // Register default Web Notification Sink if supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.registerSink({
        id: 'web_notification_sink',
        dispatch: async (payload: NotificationPayload) => {
          if (Notification.permission === 'granted') {
            new Notification(payload.title, {
              body: payload.body,
              icon: payload.icon || '/icon.png'
            });
            return true;
          }
          return false;
        }
      });
    }

    // Subscribe to Event Bus triggers
    if (typeof window !== 'undefined') {
      eventBus.subscribe('notif_engine_urges', StandardEvents.URGE_LOGGED, async (envelope) => {
        await this.dispatchNotification({
          id: `urge_${Date.now()}`,
          category: 'recovery',
          priority: 'P0',
          title: '⚡ Relapse Crisis Protocol Active',
          body: 'Take a moment. Perform Wudu and focus on immediate grounding.',
          timestamp: Date.now()
        });
      });
    }
  }

  registerSink(sink: NotificationSink): void {
    this.sinks.push(sink);
  }

  /**
   * Triggers explicit browser Web Notification permission prompt
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  }

  /**
   * Primary entry point for dispatching a notification
   */
  async dispatchNotification(rawCandidate: NotificationPayload): Promise<boolean> {
    const todayStr = getTodayDateString();

    // 1. Apply Adaptive Intelligence (Energy, Relapse Risk, Solar bounds)
    const adapted = await adaptiveIntelligenceEngine.adaptNotification(rawCandidate, todayStr);

    // 2. Evaluate Anti-Spam & Interruption Rules Gate
    const evaluation = await intelligenceRulesManager.evaluateNotification(adapted);
    if (!evaluation.shouldDispatch) {
      console.log(`[NotificationEngine] Suppressed alert ${adapted.id}: ${evaluation.reason}`);
      return false;
    }

    // 3. Dispatch to registered Sinks
    for (const sink of this.sinks) {
      try {
        await sink.dispatch(adapted);
      } catch (err) {
        console.error(`[NotificationEngine] Sink ${sink.id} error:`, err);
      }
    }

    // 4. Emit NOTIFICATION_TRIGGERED event to Event Bus
    await eventBus.publish(StandardEvents.NOTIFICATION_TRIGGERED, {
      id: adapted.id,
      category: adapted.category,
      priority: adapted.priority,
      title: adapted.title
    });

    return true;
  }
}

export const notificationEngine = new NotificationEngineImpl();
