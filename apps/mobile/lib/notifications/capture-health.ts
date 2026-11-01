import { createMMKV } from 'react-native-mmkv';

import { formatTimeAgo } from '@/lib/dates/relative-time';
import {
  emptySource,
  readCaptureHealth as readHealth,
  recordAccessOffDismissed as recordAccessOffDismissedIn,
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
  /** "Not now" on the access alert. A notification arriving clears it. */
  accessOffDismissedAt: string | null;
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

export function dismissAccessOff(at = new Date().toISOString()): void {
  recordAccessOffDismissedIn(notificationStorage, { at });
}

const REPORTED_WINDOW_MS = 30 * 86_400_000;

/** "2 reported missed" over the last 30 days, or nothing. */
export function reportedMissedLine(source: CaptureSourceHealth, now = Date.now()): string | null {
  const count = source.missed.filter((at) => now - Date.parse(at) <= REPORTED_WINDOW_MS).length;
  return count > 0 ? `${count} reported missed` : null;
}

/** "Last captured 3 hours ago", under an app's name. */
export function lastCapturedLine(source: CaptureSourceHealth, now = Date.now()): string {
  return source.lastCapturedAt
    ? `Last captured ${formatTimeAgo(source.lastCapturedAt, { now })}`
    : 'No captures yet';
}
