import { z } from 'zod';

/**
 * What became of a captured Android notification, stored on its capture log entry when the app
 * decides. Entries from before statuses existed have none and read as `ignored`. `same_payment` is
 * an alert counted once with another capture of the same payment.
 */
export const capturedNotificationStatusSchema = z.enum([
  'added',
  'auto_added',
  'same_payment',
  'waiting_for_review',
  'trying_again',
  'gave_up',
  'ignored',
  'not_linked',
]);

export type CapturedNotificationStatus = z.infer<typeof capturedNotificationStatusSchema>;
