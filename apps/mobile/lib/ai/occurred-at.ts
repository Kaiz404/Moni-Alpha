import type { ExtractDateContext } from '@/lib/ai/client/types';

const DAY_MS = 86400000;
export const MAX_BACKDATE_DAYS = 90;

function pad(n: number): string {
  return String(Math.abs(n)).padStart(2, '0');
}

/** RFC 3339 in device local time, e.g. `2026-10-12T09:30:00+08:00`. */
export function toLocalIsoWithOffset(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offsetMin / 60))}:${pad(offsetMin % 60)}`
  );
}

export function extractDateContext(now: Date): ExtractDateContext {
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    timezone = undefined;
  }
  return { clientNow: toLocalIsoWithOffset(now), timezone };
}

/**
 * Turns the model's local `YYYY-MM-DD` into the transaction timestamp. Today, missing,
 * invalid, future, or older-than-90-day dates become `now`; other past dates land at local
 * noon. A pinned boundary date would look plausible and always be wrong.
 */
export function resolveOccurredAt(occurredAt: string | null | undefined, now: Date): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(occurredAt?.trim() ?? '');
  if (!match) return now.toISOString();
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return now.toISOString();
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date.getTime() >= today.getTime()) return now.toISOString();
  const earliest = new Date(now.getTime() - MAX_BACKDATE_DAYS * DAY_MS);
  return date < earliest ? now.toISOString() : date.toISOString();
}
