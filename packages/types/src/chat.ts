import { z } from 'zod';

export const chatHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
});

export type ChatHistoryMessage = z.infer<typeof chatHistoryMessageSchema>;

/** Wire request for POST /v1/chat/analyze */
export const chatAnalyzeRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  snapshot: z.record(z.unknown()),
  history: z.array(chatHistoryMessageSchema).max(12).optional(),
});

export type ChatAnalyzeRequest = z.infer<typeof chatAnalyzeRequestSchema>;

export const chatAnalyzeOkSchema = z.object({
  status: z.literal('ok'),
  reply: z.string().max(2000),
  modelId: z.string(),
});

export const chatAnalyzeUnavailableSchema = z.object({
  status: z.literal('unavailable'),
  reason: z.string(),
});

export const chatAnalyzeResultSchema = z.discriminatedUnion('status', [
  chatAnalyzeOkSchema,
  chatAnalyzeUnavailableSchema,
]);

export type ChatAnalyzeResult = z.infer<typeof chatAnalyzeResultSchema>;
