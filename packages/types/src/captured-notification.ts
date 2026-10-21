import { z } from 'zod';

/**
 * What became of a captured Android notification, stored on its capture log entry when the app
 * decides. Entries from before statuses existed have none and read as `ignored`.
 */
export const capturedNotificationStatusSchema = z.enum([
  'added',
  'auto_added',
  'waiting_for_review',
  'ignored',
  'not_linked',
]);

export type CapturedNotificationStatus = z.infer<typeof capturedNotificationStatusSchema>;
