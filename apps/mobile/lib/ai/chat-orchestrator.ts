import { generateObject } from 'ai';
import { z } from 'zod';

export type ChatIntent = 'WALLET_QUERY' | 'SEND_FUNDS' | 'OTHER';

export type ChatTraceEvent = {
  stage: 'router' | 'executor' | 'tool-runner';
  event: string;
  details?: Record<string, unknown>;
};

export type ChatTraceLogger = (event: ChatTraceEvent) => void;

const chatRouteSchema = z.object({
  intent: z.enum(['WALLET_QUERY', 'SEND_FUNDS', 'OTHER']),
  reason: z.string(),
});

const CHAT_ROUTER_SYSTEM_PROMPT = `You are ChatRouterAgent for a personal finance assistant.

Classify user intent into exactly one:
- WALLET_QUERY: wallet balances, wallet-specific transaction history, spending summaries, account checks.
- SEND_FUNDS: logging or creating a new income/expense/transfer transaction.
- OTHER: non-finance small talk or unrelated queries.

Return JSON only with fields: intent, reason.
`;

function emit(trace: ChatTraceLogger | undefined, event: ChatTraceEvent) {
  try {
    trace?.(event);
  } catch {
    // tracing must never break runtime flow
  }
}

export async function routeChatIntentSubAgent(
  model: any,
  userInput: string,
  trace?: ChatTraceLogger,
): Promise<{ intent: ChatIntent; reason: string }> {
  emit(trace, {
    stage: 'router',
    event: 'start',
    details: { inputLength: userInput.length },
  });

  try {
    const { object } = await generateObject({
      model,
      schema: chatRouteSchema,
      system: CHAT_ROUTER_SYSTEM_PROMPT,
      prompt: `User input: ${userInput}`,
      temperature: 0,
    });

    emit(trace, {
      stage: 'router',
      event: 'decision',
      details: { intent: object.intent, reason: object.reason },
    });

    return { intent: object.intent, reason: object.reason };
  } catch (error) {
    emit(trace, {
      stage: 'router',
      event: 'fallback',
      details: {
        reason: 'router_failed_defaulting_to_SEND_FUNDS',
        error: (error as any)?.message ?? String(error),
      },
    });
    return {
      intent: 'SEND_FUNDS',
      reason: 'Router failed; defaulting to finance-capable path',
    };
  }
}
