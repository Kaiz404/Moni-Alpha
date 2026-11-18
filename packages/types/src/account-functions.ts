import { z } from 'zod';

// Responses of the Supabase Edge Functions in supabase/functions/ (contract: docs/ARCHITECTURE.md § Auth).
// A refusal from any of them is `{ error: string }` with a 4xx or 5xx status.

export const functionErrorSchema = z.object({ error: z.string() });

export const deleteAccountResponseSchema = z.object({ ok: z.literal(true) });

export const qrStartResponseSchema = z.object({
  requestId: z.string().uuid(),
  pollSecret: z.string().min(1),
  code: z.string().min(1),
  codeExpiresAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const qrPollResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('waiting'), code: z.string().min(1), codeExpiresAt: z.string().datetime() }),
  z.object({ status: z.literal('approved'), tokenHash: z.string().min(1) }),
  z.object({ status: z.literal('expired') }),
]);

export const qrApproveRequestSchema = z.object({
  code: z.string().min(1),
  step: z.enum(['check', 'approve']),
});

export const qrApproveCheckResponseSchema = z.object({ browser: z.string().min(1) });
export const qrApproveResponseSchema = z.object({ ok: z.literal(true) });

export type FunctionError = z.infer<typeof functionErrorSchema>;
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;
export type QrStartResponse = z.infer<typeof qrStartResponseSchema>;
export type QrPollResponse = z.infer<typeof qrPollResponseSchema>;
export type QrApproveRequest = z.infer<typeof qrApproveRequestSchema>;
export type QrApproveCheckResponse = z.infer<typeof qrApproveCheckResponseSchema>;
export type QrApproveResponse = z.infer<typeof qrApproveResponseSchema>;
