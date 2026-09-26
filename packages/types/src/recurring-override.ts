import { z } from 'zod';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money';

export const recurringKindSchema = z.enum(['income', 'bill', 'subscription']);
export const recurringOverrideStatusSchema = z.enum(['confirmed', 'dismissed']);

/** `${currency}|${type}|${merchantKey}`, the key the on-device recurring detector groups by. */
export const recurringSeriesKeySchema = z
  .string()
  .regex(/^[A-Z]{3}\|(income|expense)\|[a-z ]+$/, 'Invalid recurring series key');

/** The user's verdict on a detected recurring series; detection itself is never stored. */
export const recurringOverrideSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  seriesKey: recurringSeriesKeySchema,
  status: recurringOverrideStatusSchema,
  kind: recurringKindSchema.nullable(),
  expectedAmountMinor: positiveMinorAmountSchema.nullable(),
  /** Day of month the payment lands on, for monthly series. */
  expectedDay: z.number().int().min(1).max(31).nullable(),
  currency: currencyCodeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const setRecurringOverrideInputSchema = recurringOverrideSchema
  .pick({
    seriesKey: true,
    status: true,
    currency: true,
  })
  .extend({
    kind: recurringKindSchema.nullable().optional(),
    expectedAmountMinor: positiveMinorAmountSchema.nullable().optional(),
    expectedDay: z.number().int().min(1).max(31).nullable().optional(),
  });

export type RecurringKind = z.infer<typeof recurringKindSchema>;
export type RecurringOverrideStatus = z.infer<typeof recurringOverrideStatusSchema>;
export type RecurringOverride = z.infer<typeof recurringOverrideSchema>;
export type SetRecurringOverrideInput = z.infer<typeof setRecurringOverrideInputSchema>;
