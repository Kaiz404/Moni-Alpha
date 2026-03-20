import { generateText, tool } from 'ai';
import { z } from 'zod';
import { getWallets } from '@/lib/supabase/wallets';
import { createProposedTransaction } from '@/lib/supabase/proposed-transactions';
import {
  analyzeNotification,
  buildPotentialTransaction,
  passesTransactionPrefilter,
  type NotificationAnalysisDebugEvent,
  type NotificationAnalysisResult,
  type RawNotification,
} from '@/lib/ai/notification-processor';

const WALLET_RESOLUTION_AGENT_PROMPT = `You are WalletResolutionAgent.

Goal:
- Decide whether a detected notification transaction belongs to one of the user's wallets.

Rules:
1) Always call get_wallets first.
2) Compare notification app/source with wallet names.
3) Return JSON only with fields: action, walletId, reason.
4) action must be:
   - "create" if there is a confident wallet match
   - "skip" if there is no match
5) Never invent walletId values.
`;

const TRANSACTION_CREATION_AGENT_PROMPT = `You are TransactionCreationAgent.

Goal:
- Create exactly one proposed transaction by calling create_transaction.

Rules:
1) Call create_transaction exactly once.
2) Use the exact walletId provided by the user message.
3) Do not ask questions.
4) Return concise text after tool call.
`;

const walletDecisionSchema = z.object({
  action: z.enum(['create', 'skip']),
  walletId: z.string().nullable().optional(),
  reason: z.string(),
});

type WalletRecord = { id: string; name?: string | null };

export type NotificationTraceEvent = {
  stage: 'orchestrator' | 'classifier' | 'wallet-resolver' | 'creator';
  event: string;
  details?: Record<string, unknown>;
};

export type NotificationTraceLogger = (event: NotificationTraceEvent) => void;

export type NotificationOrchestrationOptions = {
  trace?: NotificationTraceLogger;
  adapters?: {
    getWallets?: () => Promise<WalletRecord[]>;
    createProposedTransaction?: (tx: ReturnType<typeof buildPotentialTransaction>) => Promise<unknown>;
  };
};

function emitTrace(
  trace: NotificationTraceLogger | undefined,
  stage: NotificationTraceEvent['stage'],
  event: string,
  details?: Record<string, unknown>,
) {
  try {
    trace?.({ stage, event, details });
  } catch {
    // tracing should never break the orchestration flow
  }
}

function fallbackClassifyNotification(
  notification: RawNotification,
): NotificationAnalysisResult {
  const merged = [
    notification.title,
    notification.titleBig,
    notification.text,
    notification.bigText,
    notification.subText,
    notification.summaryText,
    notification.extraInfoText,
  ]
    .filter(Boolean)
    .join(' ');

  if (!passesTransactionPrefilter(notification)) {
    return {
      isTransaction: false,
      reasoning:
        'Fallback classifier: failed deterministic prefilter (amount or transfer signal missing)',
    };
  }

  const money = merged.match(
    /(?:[$€£¥₦₹]|USD|EUR|GBP|NGN|INR|KES|ZAR|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY)?\s*([\d,]+(?:[.,]\d{1,2})?)/i,
  );

  const amount = money
    ? Number(String(money[1]).replace(/,/g, ''))
    : NaN;

  const currencyFromSymbol = merged.match(/[$€£¥₦₹]/)?.[0] ?? null;
  const currencyFromCode = merged.match(
    /\b(USD|EUR|GBP|NGN|INR|KES|ZAR|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY)\b/i,
  )?.[1]?.toUpperCase();

  const symbolMap: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₦': 'NGN',
    '₹': 'INR',
  };

  const currency =
    currencyFromCode ??
    (currencyFromSymbol ? symbolMap[currencyFromSymbol] : undefined) ??
    'USD';

  const lower = merged.toLowerCase();
  const isIncome = /(credited|received|refund|deposit|inbound|salary)/.test(lower);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      isTransaction: false,
      reasoning: 'Fallback classifier: could not extract a valid positive amount',
    };
  }

  return {
    isTransaction: true,
    reasoning: 'Fallback classifier: inferred transaction from deterministic signals',
    confidence: 0.35,
    amount,
    currency,
    type: isIncome ? 'income' : 'expense',
    merchant: null,
    description: merged.slice(0, 120) || null,
    walletHint: notification.app || null,
    categoryHint: null,
    transactionDate: notification.receivedAt || new Date().toISOString(),
  };
}

function appMatchesWalletName(appName: string, walletName: string): boolean {
  const source = appName.trim().toLowerCase();
  const wallet = walletName.trim().toLowerCase();
  if (!source || !wallet) return false;
  return source === wallet || source.includes(wallet) || wallet.includes(source);
}

async function classificationSubAgent(
  model: any,
  notification: RawNotification,
  trace?: NotificationTraceLogger,
) {
  const hasDeterministicSignals = passesTransactionPrefilter(notification);

  emitTrace(trace, 'classifier', 'start', {
    notificationId: notification.id,
    app: notification.app,
    hasDeterministicSignals,
  });

  const result = await analyzeNotification(
    notification,
    model,
    undefined,
    (debugEvent: NotificationAnalysisDebugEvent) => {
      emitTrace(trace, 'classifier', `analyze.${debugEvent.event}`, {
        notificationId: notification.id,
        ...(debugEvent.details ?? {}),
      });
    },
  );

  if (!result) {
    const fallback = fallbackClassifyNotification(notification);
    emitTrace(trace, 'classifier', 'fallback', {
      notificationId: notification.id,
      isTransaction: fallback.isTransaction,
      reasoning: fallback.reasoning,
    });
    return fallback;
  }

  if (!result.isTransaction && hasDeterministicSignals) {
    emitTrace(trace, 'classifier', 'sanity.low-recall-warning', {
      notificationId: notification.id,
      reasoning: result.reasoning,
    });
  }

  if (result.isTransaction && !Number.isFinite(result.amount)) {
    const fallback = fallbackClassifyNotification(notification);
    emitTrace(trace, 'classifier', 'sanity.invalid-amount.fallback', {
      notificationId: notification.id,
      reasoning: 'Model returned invalid amount; using deterministic fallback',
    });
    return fallback;
  }

  emitTrace(trace, 'classifier', 'result', {
    notificationId: notification.id,
    isTransaction: result?.isTransaction ?? null,
    reasoning: result?.reasoning,
  });

  return result;
}

async function walletResolutionSubAgent(
  model: any,
  notification: RawNotification,
  amount: number,
  transactionType: 'income' | 'expense',
  adapters: Required<NonNullable<NotificationOrchestrationOptions['adapters']>>,
  trace?: NotificationTraceLogger,
) {
  let cachedWallets: { id: string; name: string }[] = [];

  function findDeterministicWalletMatch() {
    return cachedWallets.find((wallet) =>
      appMatchesWalletName(notification.app ?? '', wallet.name),
    );
  }

  const getWalletsTool = tool({
    description: "Fetch user wallets as array of {id,name}",
    inputSchema: z.object({}),
    execute: async () => {
      emitTrace(trace, 'wallet-resolver', 'tool-call.get_wallets.start', {
        notificationId: notification.id,
      });

      const wallets = await adapters.getWallets();
      cachedWallets = wallets.map((wallet) => ({ id: wallet.id, name: wallet.name ?? '' }));
      emitTrace(trace, 'wallet-resolver', 'tool-call.get_wallets.success', {
        notificationId: notification.id,
        walletCount: cachedWallets.length,
        walletNames: cachedWallets.map((wallet) => wallet.name),
        wallets: cachedWallets.map((wallet) => ({ id: wallet.id, name: wallet.name })),
      });
      return cachedWallets;
    },
  });

  let decision: z.infer<typeof walletDecisionSchema> = {
    action: 'skip',
    walletId: null,
    reason: 'No matching wallet (default)',
  };

  try {
    emitTrace(trace, 'wallet-resolver', 'start', {
      notificationId: notification.id,
      app: notification.app,
      amount,
      transactionType,
    });

    const result = await generateText({
      model,
      system: WALLET_RESOLUTION_AGENT_PROMPT,
      prompt: [
        'Resolve wallet ownership for this notification.',
        `Notification app: ${notification.app || 'Unknown'}`,
        `Detected amount: ${amount}`,
        `Detected type: ${transactionType}`,
        'Must call get_wallets first, then return JSON decision.',
      ].join('\n'),
      output: 'json',
      schema: walletDecisionSchema,
      tools: { get_wallets: getWalletsTool },
      toolChoice: 'required',
      maxSteps: 4,
      temperature: 0,
    } as any);

    emitTrace(trace, 'wallet-resolver', 'llm-response.received', {
      notificationId: notification.id,
      hasObject: Boolean((result as any)?.object),
      hasText: Boolean((result as any)?.text),
      textPreview:
        typeof (result as any)?.text === 'string'
          ? (result as any).text.slice(0, 200)
          : null,
    });

    decision = (result as any).object ?? decision;

    if (!(result as any)?.object) {
      emitTrace(trace, 'wallet-resolver', 'llm-response.invalid-object', {
        notificationId: notification.id,
        reason: 'Missing parsed JSON object; using default decision',
      });
    }

    emitTrace(trace, 'wallet-resolver', 'llm-decision', {
      notificationId: notification.id,
      action: decision.action,
      walletId: decision.walletId ?? null,
      reason: decision.reason,
    });
  } catch {
    emitTrace(trace, 'wallet-resolver', 'llm-decision.error', {
      notificationId: notification.id,
    });
    // Keep default skip decision; deterministic fallback below may still create.
  }

  if (!cachedWallets.length) {
    try {
      const wallets = await adapters.getWallets();
      cachedWallets = wallets.map((wallet) => ({ id: wallet.id, name: wallet.name ?? '' }));
      emitTrace(trace, 'wallet-resolver', 'fallback.get_wallets.success', {
        notificationId: notification.id,
        walletCount: cachedWallets.length,
        walletNames: cachedWallets.map((wallet) => wallet.name),
        wallets: cachedWallets.map((wallet) => ({ id: wallet.id, name: wallet.name })),
      });
    } catch {
      emitTrace(trace, 'wallet-resolver', 'fallback.get_wallets.error', {
        notificationId: notification.id,
      });
      return { shouldCreate: false, walletId: null as string | null, reason: 'Wallet lookup failed' };
    }
  }

  const deterministicFirstMatch = findDeterministicWalletMatch();
  if (deterministicFirstMatch) {
    emitTrace(trace, 'wallet-resolver', 'decision.create.deterministic', {
      notificationId: notification.id,
      walletId: deterministicFirstMatch.id,
      reason: 'Deterministic app↔wallet match (authoritative)',
      app: notification.app,
      walletName: deterministicFirstMatch.name,
    });
    return {
      shouldCreate: true,
      walletId: deterministicFirstMatch.id,
      reason: 'Deterministic app↔wallet match (authoritative)',
    };
  }

  if (decision.action === 'create' && decision.walletId) {
    const exact = cachedWallets.find((wallet) => wallet.id === decision.walletId);
    if (exact && appMatchesWalletName(notification.app ?? '', exact.name)) {
      emitTrace(trace, 'wallet-resolver', 'decision.create', {
        notificationId: notification.id,
        walletId: exact.id,
        reason: decision.reason || 'Model wallet match',
      });
      return { shouldCreate: true, walletId: exact.id, reason: decision.reason || 'Model wallet match' };
    }

    emitTrace(trace, 'wallet-resolver', 'decision.create.rejected', {
      notificationId: notification.id,
      requestedWalletId: decision.walletId,
      reason: 'Model selected walletId that does not match notification app',
    });
  }

  const fallback = findDeterministicWalletMatch();
  if (fallback) {
    emitTrace(trace, 'wallet-resolver', 'decision.create.fallback', {
      notificationId: notification.id,
      walletId: fallback.id,
      reason: 'Deterministic app↔wallet fallback match',
    });
    return { shouldCreate: true, walletId: fallback.id, reason: 'Deterministic app↔wallet fallback match' };
  }

  emitTrace(trace, 'wallet-resolver', 'decision.skip', {
    notificationId: notification.id,
    reason: decision.reason || 'No wallet match',
  });
  return { shouldCreate: false, walletId: null as string | null, reason: decision.reason || 'No wallet match' };
}

async function transactionCreationSubAgent(
  model: any,
  notification: RawNotification,
  proposal: ReturnType<typeof buildPotentialTransaction>,
  walletId: string,
  adapters: Required<NonNullable<NotificationOrchestrationOptions['adapters']>>,
  trace?: NotificationTraceLogger,
): Promise<boolean> {
  let created = false;

  const createTransactionTool = tool({
    description: 'Create proposed transaction for a resolved wallet',
    inputSchema: z.object({
      walletId: z.string(),
      amount: z.number().positive(),
      type: z.enum(['income', 'expense', 'transfer']),
      merchant: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      transactionDate: z.string().optional(),
    }),
    execute: async (input) => {
      emitTrace(trace, 'creator', 'tool-call.create_transaction.start', {
        notificationId: notification.id,
        walletId: input.walletId,
        amount: input.amount,
        type: input.type,
      });

      if (input.walletId !== walletId) {
        emitTrace(trace, 'creator', 'tool-call.create_transaction.error', {
          notificationId: notification.id,
          reason: 'wallet_id_mismatch',
          expectedWalletId: walletId,
          providedWalletId: input.walletId,
        });
        return { status: 'error', reason: 'wallet_id_mismatch' };
      }

      await adapters.createProposedTransaction({
        ...proposal,
        walletId,
        amount: input.amount,
        type: input.type === 'income' ? 'income' : 'expense',
        merchant: input.merchant ?? proposal.merchant,
        description: input.description ?? proposal.description,
        transactionDate: input.transactionDate ?? proposal.transactionDate,
      });

      created = true;
      emitTrace(trace, 'creator', 'tool-call.create_transaction.success', {
        notificationId: notification.id,
        walletId,
      });
      return { status: 'created' };
    },
  });

  try {
    emitTrace(trace, 'creator', 'start', {
      notificationId: notification.id,
      walletId,
      amount: proposal.amount,
      type: proposal.type,
    });

    const result = await generateText({
      model,
      system: TRANSACTION_CREATION_AGENT_PROMPT,
      prompt: [
        'Create a transaction proposal for this wallet-matched notification.',
        `WalletId: ${walletId}`,
        `App: ${notification.app || 'Unknown'}`,
        `Amount: ${proposal.amount}`,
        `Type: ${proposal.type}`,
        `Merchant: ${proposal.merchant ?? ''}`,
        `Description: ${proposal.description ?? ''}`,
        `TransactionDate: ${proposal.transactionDate}`,
        'Call create_transaction exactly once using these fields.',
      ].join('\n'),
      tools: { create_transaction: createTransactionTool },
      toolChoice: 'required',
      maxSteps: 3,
      temperature: 0,
    } as any);

    emitTrace(trace, 'creator', 'llm-response.received', {
      notificationId: notification.id,
      hasText: Boolean((result as any)?.text),
      textPreview:
        typeof (result as any)?.text === 'string'
          ? (result as any).text.slice(0, 200)
          : null,
      createdByTool: created,
    });
  } catch {
    emitTrace(trace, 'creator', 'error', {
      notificationId: notification.id,
      reason: 'llm_or_tool_execution_failed',
    });
    // Continue to deterministic fallback below.
  }

  if (!created) {
    emitTrace(trace, 'creator', 'fallback.direct-create.start', {
      notificationId: notification.id,
      walletId,
      amount: proposal.amount,
      type: proposal.type,
      reason: 'LLM did not execute create_transaction tool',
    });

    try {
      await adapters.createProposedTransaction({
        ...proposal,
        walletId,
      });
      created = true;
      emitTrace(trace, 'creator', 'fallback.direct-create.success', {
        notificationId: notification.id,
        walletId,
      });
    } catch {
      emitTrace(trace, 'creator', 'fallback.direct-create.error', {
        notificationId: notification.id,
        walletId,
      });
    }
  }

  emitTrace(trace, 'creator', 'result', {
    notificationId: notification.id,
    created,
  });
  return created;
}

export type NotificationOrchestrationResult = {
  created: boolean;
  skipped: boolean;
  reason: string;
};

export async function runNotificationOrchestration(
  model: any,
  notification: RawNotification,
  options?: NotificationOrchestrationOptions,
): Promise<NotificationOrchestrationResult> {
  const trace = options?.trace;
  const adapters: Required<NonNullable<NotificationOrchestrationOptions['adapters']>> = {
    getWallets: options?.adapters?.getWallets ?? getWallets,
    createProposedTransaction:
      options?.adapters?.createProposedTransaction ??
      ((tx) => createProposedTransaction(tx)),
  };

  emitTrace(trace, 'orchestrator', 'start', {
    notificationId: notification.id,
    app: notification.app,
  });

  const classification = await classificationSubAgent(model, notification, trace);

  if (!classification) {
    emitTrace(trace, 'orchestrator', 'skip', {
      notificationId: notification.id,
      reason: 'Classification failed',
    });
    return { created: false, skipped: true, reason: 'Classification failed' };
  }

  if (!classification.isTransaction) {
    emitTrace(trace, 'orchestrator', 'skip', {
      notificationId: notification.id,
      reason: classification.reasoning,
    });
    return { created: false, skipped: true, reason: classification.reasoning };
  }

  const proposal = buildPotentialTransaction(notification, classification);
  if (typeof proposal.amount !== 'number' || proposal.amount <= 0) {
    emitTrace(trace, 'orchestrator', 'skip', {
      notificationId: notification.id,
      reason: 'Missing valid amount in proposal',
    });
    return { created: false, skipped: true, reason: 'Missing valid amount in proposal' };
  }

  const normalizedType: 'income' | 'expense' =
    proposal.type === 'income' ? 'income' : 'expense';

  const walletDecision = await walletResolutionSubAgent(
    model,
    notification,
    proposal.amount,
    normalizedType,
    adapters,
    trace,
  );

  if (!walletDecision.shouldCreate || !walletDecision.walletId) {
    emitTrace(trace, 'orchestrator', 'skip', {
      notificationId: notification.id,
      reason: walletDecision.reason,
    });
    return {
      created: false,
      skipped: true,
      reason: walletDecision.reason,
    };
  }

  const created = await transactionCreationSubAgent(
    model,
    notification,
    proposal,
    walletDecision.walletId,
    adapters,
    trace,
  );

  if (!created) {
    emitTrace(trace, 'orchestrator', 'skip', {
      notificationId: notification.id,
      reason: 'Create transaction tool was not executed',
    });
    return { created: false, skipped: true, reason: 'Create transaction tool was not executed' };
  }

  emitTrace(trace, 'orchestrator', 'created', {
    notificationId: notification.id,
    walletId: walletDecision.walletId,
  });
  return { created: true, skipped: false, reason: 'Created via orchestration sub-agents' };
}
