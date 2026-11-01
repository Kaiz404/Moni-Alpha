import { institutionById, textNames, type MoneySide } from './institutions';
import { merchantKey } from './routine';

/** Manual entries are often logged hours after paying, but yesterday's identical routine coffee is not a duplicate. */
const SAME_PURCHASE_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Both banks notify within seconds of an own-wallet transfer; minutes covers delayed delivery. */
const TRANSFER_PAIR_WINDOW_MS = 10 * 60 * 1000;
/** Bank and e-wallet alerts for one purchase, close enough to count once without asking. */
const ALERT_PAIR_WINDOW_MS = 10 * 60 * 1000;
/** Bank alerts can run late, so a same-amount alert this close is worth asking about even when merchants differ. */
const ALERT_PAIR_ASK_WINDOW_MS = 60 * 60 * 1000;
/** Two-letter fragments ("kl", "dc") are too generic to tie two merchants together. */
const MIN_MERCHANT_TOKEN_LENGTH = 3;
/** Company suffixes nearly every Malaysian merchant shares; they say nothing about which shop. */
const GENERIC_MERCHANT_TOKENS = new Set(['sdn', 'bhd', 'berhad', 'plt', 'enterprise', 'the']);

export type LedgerEntry = {
  id: string;
  kind: 'transaction' | 'proposal';
  type: 'income' | 'expense' | 'transfer' | null;
  walletId: string | null;
  /** Transfers: where the money went, or null while Moni doesn't know. */
  transferToWalletId?: string | null;
  currency: string;
  amountMinor: number | null;
  merchant: string | null;
  at: string;
  /** Read from a notification, so nobody chose to enter it. */
  fromAlert?: boolean;
  /** Whether `walletId` is a bank or an e-wallet. */
  side?: MoneySide | null;
  institutionId?: string | null;
  transferToInstitutionId?: string | null;
  /** It already counts two captures; a row never counts three. */
  paired?: boolean;
};

/** `high` may act without asking on a notification; `low` only ever asks in Review. */
export type PairConfidence = 'high' | 'low';

export type DuplicateMatch =
  | {
      kind: 'same_purchase';
      target: LedgerEntry;
      confidence: PairConfidence;
      /** The bank wallet the money really left, when the two captures sit in different wallets. */
      walletId: string | null;
      /** The candidate is the e-wallet's alert, which names the shop rather than the wallet. */
      preferCandidate: boolean;
    }
  | {
      kind: 'transfer_pair';
      target: LedgerEntry;
      confidence: PairConfidence;
      fromWalletId: string;
      toWalletId: string;
    };

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

function merchantsShareAWord(a: string | null, b: string | null): boolean {
  const aTokens = merchantTokens(a);
  const bTokens = merchantTokens(b);
  return !!aTokens && !!bTokens && [...aTokens].some((token) => bTokens.has(token));
}

function merchantsCompatible(a: string | null, b: string | null): boolean {
  return !merchantKey(a) || !merchantKey(b) || merchantsShareAWord(a, b);
}

function merchantNames(merchant: string | null, institutionId: string | null | undefined): boolean {
  const institution = institutionById(institutionId);
  return !!institution && textNames(merchant, institution);
}

/** Two alerts, one from a bank wallet and one from an e-wallet. */
function bankAndEwallet(a: LedgerEntry, b: LedgerEntry): { bank: LedgerEntry; ewallet: LedgerEntry } | null {
  if (!a.fromAlert || !b.fromAlert || !a.walletId || !b.walletId || a.walletId === b.walletId) {
    return null;
  }
  if (a.side === 'bank' && b.side === 'ewallet') return { bank: a, ewallet: b };
  if (a.side === 'ewallet' && b.side === 'bank') return { bank: b, ewallet: a };
  return null;
}

function samePurchase(
  candidate: LedgerEntry,
  entry: LedgerEntry,
  gapMs: number,
  windowMs: number,
): DuplicateMatch | null {
  const pair = bankAndEwallet(candidate, entry);
  if (pair) {
    // A bank alert often names the e-wallet instead of the shop ("TNG DIGITAL", "GRAB*FOOD").
    const agree =
      merchantsShareAWord(candidate.merchant, entry.merchant) ||
      merchantNames(pair.bank.merchant, pair.ewallet.institutionId);
    if (gapMs <= ALERT_PAIR_ASK_WINDOW_MS) {
      return {
        kind: 'same_purchase',
        target: entry,
        confidence: agree && gapMs <= ALERT_PAIR_WINDOW_MS ? 'high' : 'low',
        walletId: pair.bank.walletId,
        preferCandidate: pair.ewallet === candidate,
      };
    }
  }
  if (gapMs > windowMs || !merchantsCompatible(candidate.merchant, entry.merchant)) return null;
  return {
    kind: 'same_purchase',
    target: entry,
    confidence: 'low',
    walletId: pair?.bank.walletId ?? null,
    preferCandidate: !!pair && pair.ewallet === candidate,
  };
}

/** Where a row says the money left and arrived; null where it doesn't know. */
function legs(entry: LedgerEntry): { out: string | null; in: string | null } {
  if (entry.type === 'expense') return { out: entry.walletId, in: null };
  if (entry.type === 'income') return { out: null, in: entry.walletId };
  return { out: entry.walletId, in: entry.transferToWalletId ?? null };
}

/**
 * A one-way alert joins a transfer only where the transfer has a gap, or where its merchant names
 * the transfer's far side: a second RM100 purchase from Maybank is not the Maybank reload's other leg.
 */
function completesTransfer(oneWay: LedgerEntry, transfer: LedgerEntry): boolean {
  const known = legs(transfer);
  if (oneWay.type === 'expense') {
    return (
      known.out === null ||
      (known.out === oneWay.walletId && merchantNames(oneWay.merchant, transfer.transferToInstitutionId))
    );
  }
  return (
    known.in === null ||
    (known.in === oneWay.walletId &&
      (!oneWay.merchant || merchantNames(oneWay.merchant, transfer.institutionId)))
  );
}

function transferPair(
  candidate: LedgerEntry,
  entry: LedgerEntry,
  gapMs: number,
): DuplicateMatch | null {
  if (gapMs > TRANSFER_PAIR_WINDOW_MS) return null;
  if (candidate.type === 'transfer' && entry.type !== 'transfer' && !completesTransfer(entry, candidate)) return null;
  if (entry.type === 'transfer' && candidate.type !== 'transfer' && !completesTransfer(candidate, entry)) return null;
  const a = legs(candidate);
  const b = legs(entry);
  if ((a.out && b.out && a.out !== b.out) || (a.in && b.in && a.in !== b.in)) return null;
  const fromWalletId = a.out ?? b.out;
  const toWalletId = a.in ?? b.in;
  if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) return null;
  return { kind: 'transfer_pair', target: entry, confidence: 'high', fromWalletId, toWalletId };
}

function matchOne(
  candidate: LedgerEntry,
  entry: LedgerEntry,
  gapMs: number,
  samePurchaseWindowMs: number,
): DuplicateMatch | null {
  return entry.type === candidate.type && candidate.type !== 'transfer'
    ? samePurchase(candidate, entry, gapMs, samePurchaseWindowMs)
    : transferPair(candidate, entry, gapMs);
}

const isPairable = (entry: LedgerEntry) =>
  entry.type !== null && entry.amountMinor != null && !entry.paired;

/** The closest match, a `high` one first. Pure, so either alert can arrive first. */
export function findDuplicate(
  candidate: LedgerEntry,
  existing: readonly LedgerEntry[],
  { samePurchaseWindowMs = SAME_PURCHASE_WINDOW_MS }: { samePurchaseWindowMs?: number } = {},
): DuplicateMatch | null {
  if (!isPairable(candidate)) return null;
  const candidateAt = Date.parse(candidate.at);
  let best: { match: DuplicateMatch; gapMs: number } | null = null;
  for (const entry of existing) {
    if (entry.id === candidate.id || !isPairable(entry)) continue;
    if (entry.currency !== candidate.currency || entry.amountMinor !== candidate.amountMinor) {
      continue;
    }
    const gapMs = Math.abs(Date.parse(entry.at) - candidateAt);
    if (Number.isNaN(gapMs)) continue;
    const match = matchOne(candidate, entry, gapMs, samePurchaseWindowMs);
    if (!match) continue;
    const beats =
      !best ||
      (match.confidence === best.match.confidence
        ? gapMs < best.gapMs
        : match.confidence === 'high');
    if (beats) best = { match, gapMs };
  }
  return best?.match ?? null;
}
