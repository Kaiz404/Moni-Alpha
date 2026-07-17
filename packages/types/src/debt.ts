import { z } from 'zod';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money';

export const debtDirectionSchema = z.enum(['owed_to_me', 'i_owe']);
export const debtStatusSchema = z.enum(['open', 'settled', 'written_off']);
export const debtActivityKindSchema = z.enum(['principal', 'repayment', 'write_off']);

export const debtSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  counterpartyName: z.string().min(1).max(120),
  direction: debtDirectionSchema,
  currency: currencyCodeSchema,
  dueDate: z.string().date().nullable(),
  note: z.string().max(1000).nullable(),
  status: debtStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const debtActivitySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  debtId: z.string().uuid(),
  kind: debtActivityKindSchema,
  amountMinor: positiveMinorAmountSchema,
  activityDate: z.string().datetime(),
  walletId: z.string().uuid().nullable(),
  cashTransactionId: z.string().uuid().nullable(),
  note: z.string().max(1000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDebtInputSchema = z.object({
  counterpartyName: z.string().trim().min(1).max(120),
  direction: debtDirectionSchema,
  amountMinor: positiveMinorAmountSchema,
  walletId: z.string().uuid(),
  dueDate: z.string().date().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  activityDate: z.string().datetime().optional(),
});

export const createDebtActivityInputSchema = z.object({
  kind: z.enum(['principal', 'repayment']),
  amountMinor: positiveMinorAmountSchema,
  walletId: z.string().uuid(),
  note: z.string().max(1000).nullable().optional(),
  activityDate: z.string().datetime().optional(),
});

export type DebtDirection = z.infer<typeof debtDirectionSchema>;
export type DebtStatus = z.infer<typeof debtStatusSchema>;
export type DebtActivityKind = z.infer<typeof debtActivityKindSchema>;
export type Debt = z.infer<typeof debtSchema>;
export type DebtActivity = z.infer<typeof debtActivitySchema>;
export type CreateDebtInput = z.infer<typeof createDebtInputSchema>;
export type CreateDebtActivityInput = z.infer<typeof createDebtActivityInputSchema>;
