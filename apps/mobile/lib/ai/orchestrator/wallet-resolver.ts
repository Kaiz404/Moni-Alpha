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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hintMatchesWallet(hint: string, walletName: string): boolean {
  const h = hint.trim().toLowerCase();
  const w = walletName.trim().toLowerCase();
  if (!h || !w) return false;
  return h === w || h.includes(w) || w.includes(h);
}

/**
 * If the user message names a wallet (e.g. "by cash") and a wallet is literally named "Cash",
 * match on whole-word / token appearance before looser heuristics.
 */
function walletNameAppearsInHint(
  combinedHint: string,
  wallets: { id: string; name: string }[],
): { id: string; name: string } | null {
  const lower = combinedHint.toLowerCase();
  for (const w of wallets) {
    const name = w.name.trim();
    if (name.length < 2) continue;
    const n = name.toLowerCase();
    try {
      if (new RegExp(`\\b${escapeRegex(n)}\\b`, 'i').test(lower)) {
        return { id: w.id, name: w.name };
      }
    } catch {
      if (lower.includes(n)) return { id: w.id, name: w.name };
    }
  }
  return null;
}

/** Combine receipt extraction hint with the user's own message (e.g. "I paid by cash"). */
export function mergeWalletHintsForResolution(
  extractedHint: string | null | undefined,
  userNote: string | null | undefined,
): string | null {
  const u = userNote?.trim();
  const r = extractedHint?.trim();
  if (u && r) return `${u} | ${r}`;
  if (u) return u;
  if (r) return r;
  return null;
}

/**
 * Light fuzzy match: token overlap + substring between hint and wallet name.
 * Helps when the LLM extracts "Savings" as merchant but the wallet is "Primary Savings".
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
  userContext?: string | null,
): Promise<z.infer<typeof walletDecisionSchema> | null> {
  const userPrompt = [
    'Match this transaction to one of the user wallets.',
    '',
    `Available wallets (use only these ids): ${JSON.stringify(cachedWallets)}`,
    userContext?.trim()
      ? `User message (may state how they paid — e.g. cash, card, bank name): ${userContext.trim()}`
      : null,
    `Extracted payment / wallet hint (from receipt or parser): ${hint ?? 'none'}`,
    `Amount: ${amount}`,
    `Transaction type: ${transactionType}`,
    '',
    'Respond with ONLY a single JSON object (no markdown fences, no prose):',
    '{"action":"create" or "skip","walletId":"<exact id from list or null>","reason":"short"}',
  ]
    .filter((line) => line != null)
    .join('\n');

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

export type WalletResolutionOptions = {
  /** Full user message (e.g. chat caption with receipt) — used with extracted hint for matching. */
  userContext?: string | null;
};

export async function walletResolutionSubAgent(
  model: any,
  hint: string | null | undefined,
  amount: number,
  transactionType: 'income' | 'expense',
  adapters: Adapters,
  logger?: TraceLogger,
  options?: WalletResolutionOptions,
): Promise<{ shouldCreate: boolean; walletId: string | null; reason: string }> {
  let cachedWallets: { id: string; name: string }[] = [];

  try {
    const wallets = await adapters.getWallets();
    cachedWallets = wallets.map((w) => ({ id: w.id, name: w.name ?? '' }));
  } catch {
    return { shouldCreate: false, walletId: null, reason: 'Wallet lookup failed' };
  }

  const effectiveHint = mergeWalletHintsForResolution(hint, options?.userContext ?? null);

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

  if (effectiveHint) {
    const wordMatch = walletNameAppearsInHint(effectiveHint, cachedWallets);
    if (wordMatch) {
      trace(logger, 'wallet-resolver', 'word-boundary-match', {
        effectiveHint: effectiveHint.slice(0, 120),
        walletId: wordMatch.id,
        walletName: wordMatch.name,
      });
      return {
        shouldCreate: true,
        walletId: wordMatch.id,
        reason: `Matched "${wordMatch.name}" from user or hint text`,
      };
    }

    const match = cachedWallets.find((w) => hintMatchesWallet(effectiveHint, w.name));
    if (match) {
      trace(logger, 'wallet-resolver', 'deterministic-match', {
        hint: effectiveHint,
        walletId: match.id,
        walletName: match.name,
      });
      return {
        shouldCreate: true,
        walletId: match.id,
        reason: `Matched hint "${effectiveHint}" to wallet "${match.name}"`,
      };
    }

    const fuzzy = heuristicWalletMatch(effectiveHint, cachedWallets);
    if (fuzzy) {
      trace(logger, 'wallet-resolver', 'heuristic-match', {
        hint: effectiveHint,
        walletId: fuzzy.id,
        walletName: fuzzy.name,
      });
      return {
        shouldCreate: true,
        walletId: fuzzy.id,
        reason: `Heuristic match from hint "${effectiveHint}" to wallet "${fuzzy.name}"`,
      };
    }
  }

  let decision: z.infer<typeof walletDecisionSchema> = {
    action: 'skip',
    walletId: null,
    reason: 'No matching wallet (default)',
  };

  try {
    trace(logger, 'wallet-resolver', 'llm-start', {
      hint: effectiveHint,
      amount,
      transactionType,
      hasUserContext: Boolean(options?.userContext?.trim()),
    });

    const llm = await llmWalletDecision(
      model,
      cachedWallets,
      hint ?? null,
      amount,
      transactionType,
      logger,
      options?.userContext ?? null,
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
