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
  /** Why a Not linked alert needs nothing: another app's alert for the same payment was added. */
  note: string | null;
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
    note: null,
  };
}

const MONEY = /(?:\b(?:RM|MYR)|\$)\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi;
/** A ride app's receipt and the wallet's payment alert arrive about a minute apart. */
const SAME_PAYMENT_MS = 10 * 60_000;

/** The amounts an alert names, in minor units. */
function amountsIn(text: string): number[] {
  return [...text.matchAll(MONEY)].map((match) =>
    Math.round(Number(match[1].replace(/,/g, '')) * 100),
  );
}

type Received = { item: CaptureLogItem; at: number; amounts: number[] };

function sameAddedPayment(entry: Received, all: readonly Received[]): CaptureLogItem | null {
  if (entry.item.status !== 'not_linked' || entry.amounts.length === 0) return null;
  const other = all.find(
    (candidate) =>
      (candidate.item.status === 'added' || candidate.item.status === 'auto_added') &&
      candidate.item.app !== entry.item.app &&
      Math.abs(candidate.at - entry.at) <= SAME_PAYMENT_MS &&
      candidate.amounts.some((amount) => entry.amounts.includes(amount)),
  );
  return other?.item ?? null;
}

/** Newest day first, newest entry first within a day. */
export function groupCaptureLog(
  entries: readonly StoredCaptureEntry[],
  now: Date = new Date(),
): CaptureLogDay[] {
  const received: Received[] = [...entries]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((entry) => ({ entry, date: new Date(entry.receivedAt) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .map(({ entry, date }) => {
      const item = toItem(entry, date);
      return { item, at: date.getTime(), amounts: amountsIn(item.text) };
    });
  const days = new Map<string, CaptureLogDay>();
  for (const entry of received) {
    const date = new Date(entry.at);
    const key = toLocalDateInput(date);
    let day = days.get(key);
    if (!day) {
      day = { key, label: formatDayHeading(date, now), items: [] };
      days.set(key, day);
    }
    const same = sameAddedPayment(entry, received);
    day.items.push(
      same
        ? { ...entry.item, note: `Same payment as the ${same.app} alert at ${same.time}, which was added.` }
        : entry.item,
    );
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
