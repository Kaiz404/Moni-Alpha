import { z } from 'zod';
import { merchantKeySchema } from './auto-add-rule';

/** The name the user gave a merchant; every row whose merchant key is `rawKey` shows it. */
export const merchantAliasSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  rawKey: merchantKeySchema,
  displayName: z.string().trim().min(1).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean(),
});

export type MerchantAlias = z.infer<typeof merchantAliasSchema>;
