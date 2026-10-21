import { z } from 'zod';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money';
import { recurringSeriesKeySchema } from './recurring-override';

export const upcomingBillStatusSchema = z.enum(['due', 'paid', 'skipped']);

/** A bill or subscription expected this month, derived from recurring series; never stored. */
export const upcomingBillSchema = z.object({
  seriesKey: recurringSeriesKeySchema,
  name: z.string().min(1),
  amountMinor: positiveMinorAmountSchema,
  currency: currencyCodeSchema,
  /** Local calendar date, YYYY-MM-DD. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: upcomingBillStatusSchema,
  /** The wallet it pays from and its category: the user's pick, else the last payment's. */
  walletId: z.string().nullable(),
  categoryId: z.string().nullable(),
});

export type UpcomingBillStatus = z.infer<typeof upcomingBillStatusSchema>;
export type UpcomingBill = z.infer<typeof upcomingBillSchema>;
