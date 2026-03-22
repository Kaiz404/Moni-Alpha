import { generateObject } from 'ai';
import type { z } from 'zod';
import type { CreateProposedTransaction } from '@repo/types';
import { TRANSACTION_EXTRACTION_PROMPT, extractionResultSchema } from './prompts';
import { walletResolutionSubAgent } from './wallet-resolver';
import type { TraceEvent, TraceLogger, OrchestrationResult } from './types';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';
import { saveProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';

function trace(
  logger: TraceLogger | undefined,
  stage: TraceEvent['stage'],
  event: string,
  details?: Record<string, unknown>,
) {
  try { logger?.({ stage, event, details }); } catch { /* never break orchestration */ }
}

type Adapters = {
  getWallets: () => Promise<{ id: string; name?: string | null }[]>;
  createProposedTransaction: (tx: CreateProposedTransaction) => Promise<unknown>;
};

export async function textExtractionSubAgent(
  model: any,
  text: string,
  logger?: TraceLogger,
): Promise<z.infer<typeof extractionResultSchema> | null> {
  trace(logger, 'extractor', 'start', { inputLength: text.length });

  try {
    const { object } = await generateObject({
      model,
      schema: extractionResultSchema,
      system: TRANSACTION_EXTRACTION_PROMPT,
      prompt: `Extract transaction details from this user input:\n\n${text}`,
      temperature: 0,
    });

    trace(logger, 'extractor', 'result', {
      amount: object?.amount,
      type: object?.type,
      merchant: object?.merchant,
    });
    return object;
  } catch (e) {
    trace(logger, 'extractor', 'error', {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function runTextFlow(
  model: any,
  text: string,
  adapters: Adapters,
  locationSnapshot?: LocationSnapshot | null,
  logger?: TraceLogger,
): Promise<OrchestrationResult> {
  trace(logger, 'orchestrator', 'flow.text', { textLength: text.length });

  const extraction = await textExtractionSubAgent(model, text, logger);
  if (!extraction?.amount || extraction.amount <= 0) {
    return { created: false, skipped: true, reason: 'Could not extract a valid amount from text' };
  }

  const type: 'income' | 'expense' = extraction.type === 'income' ? 'income' : 'expense';

  const walletResult = await walletResolutionSubAgent(
    model,
    extraction.wallet_hint,
    extraction.amount,
    type,
    adapters,
    logger,
    { userContext: text },
  );

  const now = new Date().toISOString();
  const proposal: CreateProposedTransaction = {
    sourceType: 'text',
    sourceApp: null,
    sourceText: text,
    sourceImageUri: null,
    notificationTitle: null,
    notificationBody: null,
    notificationReceivedAt: null,
    aiReasoning: `Extracted from text input: amount=${extraction.amount}, type=${type}`,
    aiConfidence: 0.7,
    walletId: walletResult.walletId,
    walletHint: extraction.wallet_hint ?? null,
    amount: extraction.amount,
    currency: extraction.currency ?? 'MYR',
    type,
    description: extraction.description ?? (type === 'income' ? 'Income' : 'Expense'),
    merchant: extraction.merchant ?? null,
    categoryId: null,
    categoryHint: extraction.category_hint ?? null,
    transactionDate: now,
    status: 'pending',
  };

  try {
    const created = await adapters.createProposedTransaction(proposal);
    const proposalId = (created as any)?.id;
    if (proposalId && locationSnapshot) {
      saveProposalLocationSnapshot(proposalId, locationSnapshot);
    }
    trace(logger, 'creator', 'text.created', { walletId: walletResult.walletId });
    return {
      created: true,
      skipped: false,
      reason: 'Created from text input',
      proposalId,
    };
  } catch (e) {
    trace(logger, 'creator', 'text.error', { message: e instanceof Error ? e.message : String(e) });
    return { created: false, skipped: true, reason: 'Failed to create proposal' };
  }
}
