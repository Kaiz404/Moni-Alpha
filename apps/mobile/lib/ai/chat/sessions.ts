import { dayKeyInTimezone } from '@/lib/finance/dates';
import { profilePreferences$ } from '@/lib/store';

/** The profile's finance timezone, else the phone's. */
export function financeTimezone(): string {
  return (
    profilePreferences$.peek()?.finance_timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC'
  );
}

/** One thread per local date: the YYYY-MM-DD a message belongs to. */
export function threadDay(at: string | Date, timeZone: string = financeTimezone()): string {
  return dayKeyInTimezone(at, timeZone);
}

export function todayThreadDay(now: Date = new Date()): string {
  return threadDay(now);
}
