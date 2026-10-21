import type { MerchantAlias } from '@repo/types';

import { merchantKey } from '@/lib/ai/routine';

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
  /** The wallet most of its payments came from. */
  wallet: string | null;
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
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function topWallet(wallets: Map<string, number>, walletNames: Record<string, string>) {
  let best: string | null = null;
  let bestCount = 0;
  for (const [walletId, count] of wallets) {
    if (count > bestCount) {
      best = walletId;
      bestCount = count;
    }
  }
  return best ? (walletNames[best] ?? null) : null;
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

  const entry = (key: string, tally: Tally | undefined, name: string | null): MerchantEntry => ({
    key,
    raw: tally?.raw ?? key.toUpperCase(),
    name,
    count: tally?.count ?? 0,
    wallet: tally ? topWallet(tally.wallets, walletNames) : null,
    categoryId: tally?.categoryId ?? null,
    guess: guessMerchantName(key),
  });
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
