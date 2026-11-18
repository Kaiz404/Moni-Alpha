import { createCalendar } from '@repo/core';

/** The phone's own zone: the days and months every screen counts in. */
export const deviceCalendar = createCalendar(
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
);
