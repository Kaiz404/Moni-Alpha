import type { ProposedTransaction } from '@repo/types';

import { formatDay } from '@/lib/dates/day-label';
import { getCachedInstalledAppsMap } from '@/lib/notifications/installed-apps';

type Source = Pick<
  ProposedTransaction,
  'sourceType' | 'sourceApp' | 'notificationTitle'
>;

/** The banking app that sent a notification capture ("Maybank"), for the notification's header. */
export function captureBankName(proposal: Source): string {
  const app = proposal.sourceApp
    ? getCachedInstalledAppsMap()?.get(proposal.sourceApp)?.label
    : null;
  return app ?? proposal.notificationTitle ?? 'Bank';
}

/** "Maybank alert", "Moni chat", "Receipt": the source row on the card. */
export function captureSourceLabel(proposal: Source): string {
  switch (proposal.sourceType) {
    case 'notification':
      return `${captureBankName(proposal)} alert`;
    case 'text':
      return 'Moni chat';
    case 'image':
      return 'Receipt';
  }
}

/** "12:41 pm" today, otherwise "Yesterday, 7:00 pm" or "Wed 14 Oct, 7:00 pm". */
export function captureTime(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const hours = date.getHours();
  const time = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
  const day = formatDay(date, now);
  return day === 'Today' ? time : `${day}, ${time}`;
}
