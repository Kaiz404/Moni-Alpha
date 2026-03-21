import { generateText } from 'ai';
import type { z } from 'zod';
import { WALLET_RESOLUTION_PROMPT, walletDecisionSchema } from './prompts';
import type { TraceEvent, TraceLogger } from './types';

function trace(
  logger: TraceLogger | undefined,
  stage: TraceEvent['stage'],
  event: string,
  details?: Record<string, unknown>,
) {
  try { logger?.({ stage, event, details }); } catch { /* never break orchestration */ }
}

function hintMatchesWallet(hint: string, walletName: string): boolean {
  const h = hint.trim().toLowerCase();
  const w = walletName.trim().toLowerCase();
  if (!h || !w) return false;
  return h === w || h.includes(w) || w.includes(h);
}

/**
 * Light fuzzy match: token overlap + substring between hint and wallet name.
 * Helps when the LLM extracts "Savings" as merchant but the wallet is "Maybank Savings".
 */
function heuristicWalletMatch(
  hint: string | null | undefined,
  wallets: { id: string; name: string }[],
): { id: string; name: string } | null {
  if (!hint?.trim()) return null;
  const h = hint.trim().toLowerCase();
  const stop = new Set([
    'the', 'a', 'an', 'to', 'from', 'for', 'and', 'or', 'my', 'our', 'your',
  ]);
  const tokens = h
    .split(/\W+/)
    .filter((t) => t.length > 2 && !stop.has(t));

  let best: { id: string; name: string; score: number } | null = null;

  for (const w of wallets) {
    const name = w.name.trim().toLowerCase();
    if (!name) continue;

    let score = 0;
    if (name === h || name.includes(h) || h.includes(name)) {
      score += 12;
    }
    for (const t of tokens) {
      if (name.includes(t)) score += 4;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { id: w.id, name: w.name, score };
    }
  }

  // Require a minimum score so we don't match random partials
  if (best && best.score >= 4) {
    return { id: best.id, name: best.name };
  }
  return null;
}

type Adapters = {
  getWallets: () => Promise<{ id: string; name?: string | null }[]>;
};

/**
 * Wallet resolution via local LLM. Uses plain text generation + JSON parse instead of
 * `generateObject` — on @react-native-ai/llama, grammar-based structured output can fail
 * on follow-up calls or small decision schemas, while raw JSON-in-text is reliable.
 */
async function llmWalletDecision(
  model: any,
  cachedWallets: { id: string; name: string }[],
  hint: string | null | undefined,
  amount: number,
  transactionType: 'income' | 'expense',
  logger?: TraceLogger,
): Promise<z.infer<typeof walletDecisionSchema> | null> {
  const userPrompt = [
    'Match this transaction to one of the user wallets.',
    '',
    `Available wallets (use only these ids): ${JSON.stringify(cachedWallets)}`,
    `Source/hint: ${hint ?? 'none'}`,
    `Amount: ${amount}`,
    `Transaction type: ${transactionType}`,
    '',
    'Respond with ONLY a single JSON object (no markdown fences, no prose):',
    '{"action":"create" or "skip","walletId":"<exact id from list or null>","reason":"short"}',
  ].join('\n');

  const result = await generateText({
    model,
    system: WALLET_RESOLUTION_PROMPT,
    prompt: userPrompt,
    temperature: 0,
  });

  const raw = (result.text ?? '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    trace(logger, 'wallet-resolver', 'llm-no-json', { preview: raw.slice(0, 160) });
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonMatch[0]);
  } catch {
    trace(logger, 'wallet-resolver', 'llm-json-parse', { preview: raw.slice(0, 160) });
    return null;
  }

  const parsed = walletDecisionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    trace(logger, 'wallet-resolver', 'llm-schema-mismatch', {
      issues: parsed.error.flatten(),
    });
    return null;
  }

  return parsed.data;
}

export async function walletResolutionSubAgent(
  model: any,
  hint: string | null | undefined,
  amount: number,
  transactionType: 'income' | 'expense',
  adapters: Adapters,
  logger?: TraceLogger,
): Promise<{ shouldCreate: boolean; walletId: string | null; reason: string }> {
  let cachedWallets: { id: string; name: string }[] = [];

  try {
    const wallets = await adapters.getWallets();
    cachedWallets = wallets.map((w) => ({ id: w.id, name: w.name ?? '' }));
  } catch {
    return { shouldCreate: false, walletId: null, reason: 'Wallet lookup failed' };
  }

  if (cachedWallets.length === 1) {
    trace(logger, 'wallet-resolver', 'auto-select.single-wallet', {
      walletId: cachedWallets[0].id,
    });
    return {
      shouldCreate: true,
      walletId: cachedWallets[0].id,
      reason: 'Auto-selected (only wallet)',
    };
  }

  if (cachedWallets.length === 0) {
    return { shouldCreate: false, walletId: null, reason: 'No wallets configured' };
  }

  if (hint) {
    const match = cachedWallets.find((w) => hintMatchesWallet(hint, w.name));
    if (match) {
      trace(logger, 'wallet-resolver', 'deterministic-match', {
        hint,
        walletId: match.id,
        walletName: match.name,
      });
      return {
        shouldCreate: true,
        walletId: match.id,
        reason: `Matched hint "${hint}" to wallet "${match.name}"`,
      };
    }

    const fuzzy = heuristicWalletMatch(hint, cachedWallets);
    if (fuzzy) {
      trace(logger, 'wallet-resolver', 'heuristic-match', {
        hint,
        walletId: fuzzy.id,
        walletName: fuzzy.name,
      });
      return {
        shouldCreate: true,
        walletId: fuzzy.id,
        reason: `Heuristic match from hint "${hint}" to wallet "${fuzzy.name}"`,
      };
    }
  }

  let decision: z.infer<typeof walletDecisionSchema> = {
    action: 'skip',
    walletId: null,
    reason: 'No matching wallet (default)',
  };

  try {
    trace(logger, 'wallet-resolver', 'llm-start', { hint, amount, transactionType });

    const llm = await llmWalletDecision(
      model,
      cachedWallets,
      hint,
      amount,
      transactionType,
      logger,
    );

    if (llm) {
      decision = llm;
      trace(logger, 'wallet-resolver', 'llm-decision', {
        action: decision.action,
        walletId: decision.walletId ?? null,
      });
    } else {
      trace(logger, 'wallet-resolver', 'llm-empty', {});
    }
  } catch (e) {
    trace(logger, 'wallet-resolver', 'llm-error', {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (decision.action === 'create' && decision.walletId) {
    const valid = cachedWallets.find((w) => w.id === decision.walletId);
    if (valid) {
      return { shouldCreate: true, walletId: valid.id, reason: decision.reason };
    }
  }

  return { shouldCreate: true, walletId: null, reason: 'No wallet match - no proposal created' };
}
