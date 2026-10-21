import { z } from 'zod';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money';

export const recurringKindSchema = z.enum(['income', 'bill', 'subscription']);
export const recurringOverrideStatusSchema = z.enum(['confirmed', 'dismissed']);

/** `${currency}|${type}|${merchantKey}`, the key the on-device recurring detector groups by. */
export const recurringSeriesKeySchema = z
  .string()
  .regex(/^[A-Z]{3}\|(income|expense)\|[a-z ]+$/, 'Invalid recurring series key');

const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month');
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');
export const billNameSchema = z.string().trim().min(1).max(30);

/**
 * The user's verdict on a detected recurring series; detection itself is never stored. A
 * confirmed `bill` or `subscription` override is a bill, with or without payment history.
 */
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
  /** `YYYY-MM`: the bill is skipped for that month and nothing is due. */
  skipPeriod: monthKeySchema.nullable().optional(),
  /** A local reminder fires the day before the bill is due. */
  remind: z.boolean().optional(),
  /** The bill's own name; null shows the merchant from the series. */
  name: billNameSchema.nullable().optional(),
  /** The wallet the bill pays from and the category it lands in; null follows the last payment. */
  walletId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  /** Local `YYYY-MM-DD` of a bill due just once; null for a monthly bill. */
  dueOnce: localDateSchema.nullable().optional(),
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
    skipPeriod: monthKeySchema.nullable().optional(),
    remind: z.boolean().optional(),
    name: billNameSchema.nullable().optional(),
    walletId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    dueOnce: localDateSchema.nullable().optional(),
  });

export type RecurringKind = z.infer<typeof recurringKindSchema>;
export type RecurringOverrideStatus = z.infer<typeof recurringOverrideStatusSchema>;
export type RecurringOverride = z.infer<typeof recurringOverrideSchema>;
export type SetRecurringOverrideInput = z.infer<typeof setRecurringOverrideInputSchema>;
