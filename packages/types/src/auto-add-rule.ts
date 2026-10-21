import { z } from 'zod';

/** Lowercase letters and spaces: the key `merchantKey` in apps/mobile/lib/ai/routine.ts builds. */
export const merchantKeySchema = z.string().regex(/^[a-z]+( [a-z]+)*$/, 'Invalid merchant key');

/**
 * "Don't ask about similar": an alert from `sourceApp` for `merchantKey` goes straight to the
 * ledger in `walletId` under `categoryId`, marked Auto.
 */
export const autoAddRuleSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  merchantKey: merchantKeySchema,
  /** Android package (or app label when the package is unknown) the alert came from. */
  sourceApp: z.string().min(1),
  walletId: z.string().uuid(),
  categoryId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean(),
});

export const createAutoAddRuleInputSchema = autoAddRuleSchema.pick({
  merchantKey: true,
  sourceApp: true,
  walletId: true,
  categoryId: true,
});

export type AutoAddRule = z.infer<typeof autoAddRuleSchema>;
export type CreateAutoAddRuleInput = z.infer<typeof createAutoAddRuleInputSchema>;
