import type { MerchantAlias, MinorAmount } from '@repo/types';

import type { FinanceTransaction } from './types';

/**
 * Drops id-like tokens (any digit), then keeps letters: "GRAB* A-12XY" and "Grab A-98QZ" become
 * "grab". Card processors write "GRAB*1234 KL": a reference right after the star means the
 * merchant is the part before it.
 */
export function merchantKey(merchant: string | null): string | null {
  const text = (merchant ?? '').toLowerCase();
  const star = text.indexOf('*');
  const afterStar = star < 0 ? '' : (text.slice(star + 1).trim().split(/\s+/)[0] ?? '');
  const name = star > 0 && /\d/.test(afterStar) ? text.slice(0, star) : text.replace(/\*/g, ' ');
  const key = name
    .split(/\s+/)
    .filter((token) => !/\d/.test(token))
    .join(' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return key || null;
}

export function merchantName(
  raw: string | null,
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[],
): string | null {
  const key = merchantKey(raw);
  return (key && aliases.find((alias) => alias.rawKey === key)?.displayName) || raw;
}

export type MerchantSpend = {
  name: string;
  payments: number;
  spentMinor: MinorAmount;
  /** The wallet most of these payments came from. */
  walletId: string;
};

/** The biggest merchants among some spending, by total. */
export function topMerchants(
  transactions: readonly FinanceTransaction[],
  limit: number,
): { merchants: MerchantSpend[]; count: number } {
  const byName = new Map<string, MerchantSpend & { wallets: Map<string, number> }>();
  for (const transaction of transactions) {
    const name = transaction.merchant ?? transaction.description;
    if (!name) continue;
    const entry = byName.get(name) ?? {
      name,
      payments: 0,
      spentMinor: 0 as MinorAmount,
      walletId: transaction.walletId,
      wallets: new Map<string, number>(),
    };
    entry.payments += 1;
    entry.spentMinor = (entry.spentMinor + Number(transaction.amountMinor)) as MinorAmount;
    entry.wallets.set(transaction.walletId, (entry.wallets.get(transaction.walletId) ?? 0) + 1);
    byName.set(name, entry);
  }
  const merchants = [...byName.values()]
    .sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name))
    .map(({ wallets, ...merchant }) => ({
      ...merchant,
      walletId: [...wallets.entries()].sort((a, b) => b[1] - a[1])[0]![0],
    }));
  return { merchants: merchants.slice(0, limit), count: merchants.length };
}

/** A code shows up in To name once it has this many payments. */
export const TO_NAME_MIN_PAYMENTS = 3;

export type MerchantPayment = {
  merchant: string | null;
  walletId: string;
  categoryId: string | null;
  transactionDate: string;
  /** Captured from a bank notification. */
  fromAlert: boolean;
};

/** One merchant key: the bank's latest raw text for it and the user's name, if any. */
export type MerchantEntry = {
  key: string;
  raw: string;
  name: string | null;
  count: number;
  /** The wallet most of its payments came from, by name and by id. */
  wallet: string | null;
  walletId: string | null;
  categoryId: string | null;
  guess: string | null;
};

type Tally = {
  raw: string;
  latest: string;
  count: number;
  categoryId: string | null;
  coded: boolean;
  wallets: Map<string, number>;
};

/** Bank codes are shouting or carry references; "Starbucks" typed by hand is already a name. */
function looksLikeCode(raw: string): boolean {
  return /[*\d]/.test(raw) || !/[a-z]/.test(raw);
}

/** A title-cased key, when its words are long enough to read as a name ("grab food" is "Grab Food"). */
export function guessMerchantName(key: string): string | null {
  const words = key.split(' ');
  if (words.length > 3 || words.some((word) => word.length < 3)) return null;
  return words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join(' ');
}

function topWallet(wallets: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [walletId, count] of wallets) {
    if (count > bestCount) {
      best = walletId;
      bestCount = count;
    }
  }
  return best;
}

/**
 * To name: codes from alerts with enough payments and no name yet, most payments first.
 * Named: every alias, most payments first.
 */
export function merchantNameList(
  payments: readonly MerchantPayment[],
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[],
  walletNames: Record<string, string>,
): { toName: MerchantEntry[]; named: MerchantEntry[] } {
  const tallies = new Map<string, Tally>();
  for (const payment of payments) {
    const key = merchantKey(payment.merchant);
    if (!key || !payment.merchant) continue;
    const tally = tallies.get(key) ?? {
      raw: payment.merchant,
      latest: payment.transactionDate,
      count: 0,
      categoryId: payment.categoryId,
      coded: false,
      wallets: new Map<string, number>(),
    };
    tally.count += 1;
    tally.coded ||= payment.fromAlert || looksLikeCode(payment.merchant);
    tally.wallets.set(payment.walletId, (tally.wallets.get(payment.walletId) ?? 0) + 1);
    if (payment.transactionDate > tally.latest) {
      tally.latest = payment.transactionDate;
      tally.raw = payment.merchant;
      tally.categoryId = payment.categoryId ?? tally.categoryId;
    }
    tallies.set(key, tally);
  }

  const entry = (key: string, tally: Tally | undefined, name: string | null): MerchantEntry => {
    const walletId = tally ? topWallet(tally.wallets) : null;
    return {
      key,
      raw: tally?.raw ?? key.toUpperCase(),
      name,
      count: tally?.count ?? 0,
      wallet: walletId ? (walletNames[walletId] ?? null) : null,
      walletId,
      categoryId: tally?.categoryId ?? null,
      guess: guessMerchantName(key),
    };
  };
  const byCount = (a: MerchantEntry, b: MerchantEntry) =>
    b.count - a.count || a.raw.localeCompare(b.raw);

  const names = new Map(aliases.map((alias) => [alias.rawKey, alias.displayName]));
  const toName = [...tallies.entries()]
    .filter(
      ([key, tally]) =>
        !names.has(key) && tally.coded && tally.count >= TO_NAME_MIN_PAYMENTS,
    )
    .map(([key, tally]) => entry(key, tally, null))
    .sort(byCount);
  const named = [...names.entries()]
    .map(([key, name]) => entry(key, tallies.get(key), name))
    .sort(byCount);
  return { toName, named };
}
