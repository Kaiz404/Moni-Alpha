import type { CapturedNotificationStatus } from '@repo/types';
import { formatDayHeading } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';

/** The five glossary words, in the order the filter chips and the legend list them. */
export const CAPTURE_STATUS_LABELS = {
  waiting_for_review: 'Waiting for review',
  auto_added: 'Auto-added',
  added: 'Added',
  not_linked: 'Not linked',
  ignored: 'Ignored',
} as const satisfies Record<CapturedNotificationStatus, string>;

export type CaptureStatusLabel = (typeof CAPTURE_STATUS_LABELS)[CapturedNotificationStatus];

export const CAPTURE_STATUS_ORDER = Object.keys(
  CAPTURE_STATUS_LABELS,
) as CapturedNotificationStatus[];

/** A capture log entry as stored on the phone; entries from before G3 carry no status. */
export type StoredCaptureEntry = {
  id: string;
  receivedAt: string;
  app?: string;
  packageName?: string;
  title?: string;
  text?: string;
  bigText?: string;
  subText?: string;
  summaryText?: string;
  status?: CapturedNotificationStatus;
  transactionId?: string;
};

export type CaptureLogItem = {
  id: string;
  app: string;
  packageName: string | null;
  time: string;
  /** The alert text exactly as the app sent it. */
  text: string;
  status: CapturedNotificationStatus;
  label: CaptureStatusLabel;
  transactionId: string | null;
};

export type CaptureLogDay = {
  /** Local `YYYY-MM-DD`. */
  key: string;
  label: string;
  items: CaptureLogItem[];
};

function clockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

function toItem(entry: StoredCaptureEntry, received: Date): CaptureLogItem {
  const status = entry.status ?? 'ignored';
  return {
    id: entry.id,
    app: entry.app?.trim() || entry.packageName || 'Unknown app',
    packageName: entry.packageName ?? null,
    time: clockTime(received),
    text:
      entry.bigText || entry.text || entry.summaryText || entry.subText || entry.title || '',
    status,
    label: CAPTURE_STATUS_LABELS[status],
    transactionId: entry.transactionId ?? null,
  };
}

/** Newest day first, newest entry first within a day. */
export function groupCaptureLog(
  entries: readonly StoredCaptureEntry[],
  now: Date = new Date(),
): CaptureLogDay[] {
  const days = new Map<string, CaptureLogDay>();
  const sorted = [...entries].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  for (const entry of sorted) {
    const received = new Date(entry.receivedAt);
    if (Number.isNaN(received.getTime())) continue;
    const key = toLocalDateInput(received);
    let day = days.get(key);
    if (!day) {
      day = { key, label: formatDayHeading(received, now), items: [] };
      days.set(key, day);
    }
    day.items.push(toItem(entry, received));
  }
  return [...days.values()];
}

export function countByStatus(
  days: readonly CaptureLogDay[],
): Record<CapturedNotificationStatus, number> {
  const counts = { added: 0, auto_added: 0, waiting_for_review: 0, ignored: 0, not_linked: 0 };
  for (const day of days) for (const item of day.items) counts[item.status] += 1;
  return counts;
}

export function filterCaptureLog(
  days: readonly CaptureLogDay[],
  status: CapturedNotificationStatus | 'all',
): CaptureLogDay[] {
  if (status === 'all') return [...days];
  return days
    .map((day) => ({ ...day, items: day.items.filter((item) => item.status === status) }))
    .filter((day) => day.items.length > 0);
}
