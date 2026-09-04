import { merchantKey } from './routine';

/** Manual entries are often logged hours after paying, but yesterday's identical routine coffee is not a duplicate. */
const SAME_PURCHASE_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Both banks notify within seconds of an own-wallet transfer; minutes covers delayed delivery. */
const TRANSFER_PAIR_WINDOW_MS = 10 * 60 * 1000;
/** Two-letter fragments ("kl", "dc") are too generic to tie two merchants together. */
const MIN_MERCHANT_TOKEN_LENGTH = 3;
/** Company suffixes nearly every Malaysian merchant shares; they say nothing about which shop. */
const GENERIC_MERCHANT_TOKENS = new Set(['sdn', 'bhd', 'berhad', 'plt', 'enterprise', 'the']);

export type LedgerEntry = {
  id: string;
  kind: 'transaction' | 'proposal';
  type: 'income' | 'expense' | 'transfer' | null;
  walletId: string | null;
  currency: string;
  amountMinor: number | null;
  merchant: string | null;
  at: string;
};

export type DuplicateMatch =
  | { kind: 'same_purchase'; target: LedgerEntry }
  | { kind: 'transfer_pair'; target: LedgerEntry; fromWalletId: string; toWalletId: string };

function merchantTokens(merchant: string | null): Set<string> | null {
  const key = merchantKey(merchant);
  if (!key) return null;
  return new Set(
    key
      .split(' ')
      .filter(
        (token) =>
          token.length >= MIN_MERCHANT_TOKEN_LENGTH && !GENERIC_MERCHANT_TOKENS.has(token),
      ),
  );
}

function merchantsCompatible(a: string | null, b: string | null): boolean {
  const aTokens = merchantTokens(a);
  const bTokens = merchantTokens(b);
  if (!aTokens || !bTokens) return true;
  return [...aTokens].some((token) => bTokens.has(token));
}

function matchOne(
  candidate: LedgerEntry,
  entry: LedgerEntry,
  gapMs: number,
): DuplicateMatch | null {
  if (entry.type === candidate.type) {
    if (gapMs > SAME_PURCHASE_WINDOW_MS) return null;
    if (!merchantsCompatible(candidate.merchant, entry.merchant)) return null;
    return { kind: 'same_purchase', target: entry };
  }
  if (gapMs > TRANSFER_PAIR_WINDOW_MS) return null;
  const [fromWalletId, toWalletId] =
    candidate.type === 'expense'
      ? [candidate.walletId, entry.walletId]
      : [entry.walletId, candidate.walletId];
  if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) return null;
  return { kind: 'transfer_pair', target: entry, fromWalletId, toWalletId };
}

const isIncomeOrExpense = (entry: LedgerEntry) =>
  (entry.type === 'income' || entry.type === 'expense') && entry.amountMinor != null;

export function findDuplicate(
  candidate: LedgerEntry,
  existing: readonly LedgerEntry[],
): DuplicateMatch | null {
  if (!isIncomeOrExpense(candidate)) return null;
  const candidateAt = Date.parse(candidate.at);
  let best: { match: DuplicateMatch; gapMs: number } | null = null;
  for (const entry of existing) {
    if (entry.id === candidate.id || !isIncomeOrExpense(entry)) continue;
    if (entry.currency !== candidate.currency || entry.amountMinor !== candidate.amountMinor) {
      continue;
    }
    const gapMs = Math.abs(Date.parse(entry.at) - candidateAt);
    if (Number.isNaN(gapMs) || (best && gapMs >= best.gapMs)) continue;
    const match = matchOne(candidate, entry, gapMs);
    if (match) best = { match, gapMs };
  }
  return best?.match ?? null;
}
