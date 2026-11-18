import { z } from 'zod';

/**
 * What became of a captured Android notification, stored on its capture log entry when the app
 * decides. Entries from before statuses existed have none and read as `ignored`. `same_payment` is
 * an alert counted once with another capture of the same payment. `needs_ai` waits for the user to
 * turn Moni's AI on for alerts.
 */
export const capturedNotificationStatusSchema = z.enum([
  'added',
  'auto_added',
  'same_payment',
  'waiting_for_review',
  'trying_again',
  'gave_up',
  'needs_ai',
  'ignored',
  'not_linked',
]);

export type CapturedNotificationStatus = z.infer<typeof capturedNotificationStatusSchema>;
