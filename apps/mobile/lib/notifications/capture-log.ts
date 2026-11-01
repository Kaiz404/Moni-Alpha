import type { CapturedNotificationStatus } from '@repo/types';
import { formatDayHeading } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { isOneTimeCode } from '@/lib/notifications/notification-filter';

/** The glossary words, in the order the filter chips and the legend list them. */
export const CAPTURE_STATUS_LABELS = {
  waiting_for_review: 'Waiting for review',
  trying_again: 'Trying again',
  gave_up: "Couldn't reach Moni",
  auto_added: 'Auto-added',
  added: 'Added',
  same_payment: 'Same payment',
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
  groupedMessages?: { title?: string; text?: string }[];
  status?: CapturedNotificationStatus;
  transactionId?: string;
  /** Set at intake, which also blanks the text. */
  oneTimeCode?: boolean;
  pairedProposalId?: string;
};

export const ONE_TIME_CODE_NOTE = 'One-time code. Moni did not keep it.';

export type CaptureLogItem = {
  id: string;
  app: string;
  packageName: string | null;
  time: string;
  receivedAt: string;
  /** The alert text exactly as the app sent it. */
  text: string;
  oneTimeCode: boolean;
  status: CapturedNotificationStatus;
  label: CaptureStatusLabel;
  transactionId: string | null;
  /** A Same payment entry whose other capture still waits in Review. */
  pairedProposalId: string | null;
  /** Why a Not linked or Same payment alert needs nothing: another app's alert for the same payment was added. */
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

/** The listener's `app` is the package id, which is no name to show. */
function appName(
  entry: StoredCaptureEntry,
  appLabel: (packageName: string) => string | null,
): string {
  const sent = entry.app?.trim();
  if (sent && sent !== entry.packageName) return sent;
  return (entry.packageName && appLabel(entry.packageName)) || sent || 'Unknown app';
}

function toItem(
  entry: StoredCaptureEntry,
  received: Date,
  appLabel: (packageName: string) => string | null,
): CaptureLogItem {
  const status = entry.status ?? 'ignored';
  // Entries from before the on-device filter still hold their text.
  const oneTimeCode = entry.oneTimeCode === true || isOneTimeCode(entry);
  return {
    id: entry.id,
    app: appName(entry, appLabel),
    packageName: entry.packageName ?? null,
    time: clockTime(received),
    receivedAt: entry.receivedAt,
    text: oneTimeCode
      ? ONE_TIME_CODE_NOTE
      : entry.bigText || entry.text || entry.summaryText || entry.subText || entry.title || '',
    oneTimeCode,
    status,
    label: CAPTURE_STATUS_LABELS[status],
    transactionId: entry.transactionId ?? null,
    pairedProposalId: entry.pairedProposalId ?? null,
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

function pairedNote(entry: Received, all: readonly Received[]): string | null {
  if (entry.item.status !== 'same_payment') return null;
  const { transactionId, pairedProposalId } = entry.item;
  const other = all.find(
    ({ item }) =>
      item.id !== entry.item.id &&
      (item.id === pairedProposalId || (!!transactionId && item.transactionId === transactionId)),
  );
  return other
    ? `Counted once, with the ${other.item.app} alert at ${other.item.time}.`
    : 'Counted once, with a payment already in your transactions.';
}

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
  appLabel: (packageName: string) => string | null = () => null,
): CaptureLogDay[] {
  const received: Received[] = [...entries]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((entry) => ({ entry, date: new Date(entry.receivedAt) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .map(({ entry, date }) => {
      const item = toItem(entry, date, appLabel);
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
    day.items.push({
      ...entry.item,
      note: same
        ? `Same payment as the ${same.app} alert at ${same.time}, which was added.`
        : pairedNote(entry, received),
    });
  }
  return [...days.values()];
}

export function countByStatus(
  days: readonly CaptureLogDay[],
): Record<CapturedNotificationStatus, number> {
  const counts = {
    added: 0,
    auto_added: 0,
    same_payment: 0,
    waiting_for_review: 0,
    trying_again: 0,
    gave_up: 0,
    ignored: 0,
    not_linked: 0,
  };
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
