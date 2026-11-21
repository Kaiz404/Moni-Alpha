import { dayLabel, formatSignedMoney, type Calendar, type TransactionRow } from '@repo/core';
import type { ProposedTransaction } from '@repo/types';

/** "12:41 pm" in the user's zone (glossary: times lowercase with a space). */
export function clockTime(at: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(
    new Date(at),
  );
  const part = (type: string) => parts.find((each) => each.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')} ${part('dayPeriod').toLowerCase()}`;
}

/** "Today", "Yesterday" or "Mon 12 Oct" for a row's day. */
export function rowDay(at: string, now: Date, calendar: Calendar): string {
  return dayLabel(calendar.dayKey(at), calendar.dayKey(now));
}

/** A row's when: "7:31 pm" today, else "Yesterday" or "Mon 12 Oct". */
export function rowWhen(at: string, now: Date, calendar: Calendar): string {
  return calendar.dayKey(at) === calendar.dayKey(now) ? clockTime(at, calendar.zone) : rowDay(at, now, calendar);
}

export type AmountTone = 'expense' | 'income' | 'transfer';

/** −RM45.90 for spending, +RM350.00 in Deep mint for income, unsigned Meta for a transfer. */
export function rowAmount(row: Pick<TransactionRow, 'kind' | 'amountMinor' | 'currency'>): { text: string; tone: AmountTone } {
  return { text: formatSignedMoney(row.kind, row.amountMinor, row.currency), tone: row.kind };
}

/** Where a capture came from, for the Review card's meta: "Moni chat", "Receipt", or the bank's alert. */
export function captureSource(proposal: Pick<ProposedTransaction, 'sourceType' | 'notificationTitle'>): string {
  switch (proposal.sourceType) {
    case 'text':
      return 'Moni chat';
    case 'image':
      return 'Receipt';
    case 'notification':
      return proposal.notificationTitle ? `${proposal.notificationTitle} alert` : 'Bank alert';
  }
}

/** The Source column: how a transaction arrived, from its metadata. */
export const SOURCE_LABELS = {
  manual: 'Manual',
  voice: 'Voice',
  moni: 'Moni',
  notification: 'Notification',
  camera: 'Camera',
} as const;

export type SourceKey = keyof typeof SOURCE_LABELS;

export const SOURCE_ICONS: Record<SourceKey, string> = {
  manual: 'pencil-outline',
  voice: 'microphone',
  moni: 'message-text-outline',
  notification: 'bell-outline',
  camera: 'camera-outline',
};

export function sourceOf(metadata: Record<string, unknown>): SourceKey {
  const source = metadata.source;
  return typeof source === 'string' && source in SOURCE_LABELS ? (source as SourceKey) : 'manual';
}
