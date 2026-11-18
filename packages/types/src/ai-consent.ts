import { z } from 'zod';

/**
 * The things Moni's AI can read, each with its own switch: payment alerts, what the user says in
 * Say it, receipts from Scan a receipt, and everything sent in Moni chat.
 */
export const aiUseSchema = z.enum(['alerts', 'add', 'receipts', 'chat']);
export type AiUse = z.infer<typeof aiUseSchema>;
export const AI_USES = aiUseSchema.options;

/** `all` is the master switch, "Let Moni use AI". */
export const aiConsentScopeSchema = z.enum(['all', ...AI_USES]);
export type AiConsentScope = z.infer<typeof aiConsentScopeSchema>;

/** A row of the `ai_consent_current` view: the newest choice for one scope. */
export const aiConsentRowSchema = z.object({
  use: aiConsentScopeSchema,
  granted: z.boolean(),
  created_at: z.string(),
});
export type AiConsentRow = z.infer<typeof aiConsentRowSchema>;

/**
 * The date of the notice the opt-in page shows, stored on every consent row. Change it whenever
 * the notice says something new, so the record shows which words each choice answered.
 */
export const AI_NOTICE_VERSION = '2026-11-19';
