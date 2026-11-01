import { createMMKV } from 'react-native-mmkv';

import { formatTimeAgo } from '@/lib/dates/relative-time';
import {
  emptySource,
  readCaptureHealth as readHealth,
  recordCapture as recordCaptureIn,
  recordLinked as recordLinkedIn,
  recordMissed as recordMissedIn,
  recordQuietDismissed as recordQuietDismissedIn,
} from './capture-health.core.js';
import { canonicalNotificationPackage } from './notification-package-aliases';

const notificationStorage = createMMKV({ id: 'moni-notifications' });

export type CaptureSourceHealth = {
  lastHeardAt: string | null;
  lastCapturedAt: string | null;
  /** Local `YYYY-MM-DD` with a capture, newest first. */
  captureDays: string[];
  /** Reported missed transactions, newest first. */
  missed: string[];
  linkedAt: string | null;
  quietDismissedAt: string | null;
};

export type CaptureHealth = {
  /** The last notification from any app: the listener was alive then. */
  listenerHeardAt: string | null;
  sources: Record<string, CaptureSourceHealth>;
};

export function readCaptureHealth(): CaptureHealth {
  return readHealth(notificationStorage) as CaptureHealth;
}

export function sourceHealth(health: CaptureHealth, packageName: string): CaptureSourceHealth {
  return {
    ...(emptySource() as CaptureSourceHealth),
    ...health.sources[canonicalNotificationPackage(packageName)],
  };
}

export function recordCapture(packageName: string | undefined, at: string): void {
  recordCaptureIn(notificationStorage, { packageName, at });
}

export function recordMissedTransaction(packageName: string, at = new Date().toISOString()): void {
  recordMissedIn(notificationStorage, { packageName, at });
}

export function recordSourceLinked(packageName: string, at = new Date().toISOString()): void {
  recordLinkedIn(notificationStorage, { packageName, at });
}

export function dismissQuietSource(packageName: string, at = new Date().toISOString()): void {
  recordQuietDismissedIn(notificationStorage, { packageName, at });
}

/** "Last captured 3 hours ago", under an app's name. */
export function lastCapturedLine(source: CaptureSourceHealth, now = Date.now()): string {
  return source.lastCapturedAt
    ? `Last captured ${formatTimeAgo(source.lastCapturedAt, { now })}`
    : 'No captures yet';
}
