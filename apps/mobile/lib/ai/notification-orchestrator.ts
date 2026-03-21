/**
 * Backward-compatible wrapper around the unified orchestrator.
 * Existing code that imports from this module will continue to work.
 */
import { runOrchestration, type OrchestrationOptions, type TraceLogger } from './orchestrator/index';
import type { RawNotification } from './notification-processor';

export type NotificationTraceEvent = {
  stage: 'orchestrator' | 'classifier' | 'wallet-resolver' | 'creator';
  event: string;
  details?: Record<string, unknown>;
};

export type NotificationTraceLogger = (event: NotificationTraceEvent) => void;

export type NotificationOrchestrationOptions = {
  trace?: NotificationTraceLogger;
  adapters?: OrchestrationOptions['adapters'];
};

export type NotificationOrchestrationResult = {
  created: boolean;
  skipped: boolean;
  reason: string;
};

export async function runNotificationOrchestration(
  model: any,
  notification: RawNotification,
  options?: NotificationOrchestrationOptions,
): Promise<NotificationOrchestrationResult> {
  const result = await runOrchestration(
    model,
    {
      id: notification.id,
      type: 'notification',
      notification,
      createdAt: notification.receivedAt || new Date().toISOString(),
      status: 'pending',
    },
    {
      trace: options?.trace as TraceLogger,
      adapters: options?.adapters,
    },
  );

  return {
    created: result.created,
    skipped: result.skipped,
    reason: result.reason,
  };
}
