/**
 * FinanceFacts: deterministic per-currency facts for chat (balances, recurring series, payday,
 * forecast). Built on-device from the ledger; the model narrates them and never computes.
 */
import {
  decimalToMinor,
  minorToNumber,
  type MinorAmount,
  type RecurringKind,
  type RecurringOverride,
} from '@repo/types';
import { dayKey } from './days';
import {
  balanceMinor,
  forecastCurrency,
  liquidWallets,
  type FactsWallet,
  type Forecast,
} from './forecast';
import {
  detectRecurring,
  pickPayday,
  type Cadence,
  type FactsTransaction,
  type RecurringSeries,
} from './recurring';

export type { FactsTransaction, FactsWallet, Forecast };

export type AskedAmount = { amountMinor: MinorAmount; currency: string | null };

export type FinanceFactsInput = {
  wallets: readonly FactsWallet[];
  transactions: readonly FactsTransaction[];
  overrides: readonly RecurringOverride[];
  categoryNames?: Record<string, string>;
  /** An amount the user asked about ("can I afford RM800?"); without a currency it is tried in each. */
  askedAmount?: AskedAmount | null;
};

export type RecurringFact = {
  name: string;
  kind: RecurringKind;
  cadence: Cadence;
  amount: number;
  lastDate: string;
  nextDate: string;
  occurrences: number;
  confidence: number;
  needsConfirm: boolean;
};

export type FinanceFacts = {
  /** Cash, bank, debit and e-wallet accounts only; credit and investment wallets are left out. */
  balances: { liquid: number; changeLast30Days: number; walletCount: number } | null;
  recurring: RecurringFact[];
  payday: { name: string; amount: number; cadence: Cadence; nextDate: string } | null;
  forecast: Forecast;
};

const MAX_RECURRING = 15;

const CURRENCY_TOKENS: Record<string, string> = {
  rm: 'MYR',
  myr: 'MYR',
  s$: 'SGD',
  sgd: 'SGD',
  us$: 'USD',
  usd: 'USD',
  $: 'USD',
};
const TOKEN = String.raw`(rm|myr|s\$|sgd|us\$|usd|\$)`;
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?`;
const TAGGED_BEFORE = new RegExp(String.raw`(?<![a-z])${TOKEN}\s?${AMOUNT}`, 'i');
const TAGGED_AFTER = new RegExp(String.raw`${AMOUNT}\s?(rm|myr|sgd|usd)\b`, 'i');
const BARE = new RegExp(String.raw`\b${AMOUNT}\b`);
const AFFORD = /\b(afford|can i buy|can i spend|should i buy|enough for)\b/i;

/**
 * The amount in an affordability question, with its currency when the user named one. A plain
 * spending question ("did I spend RM50 on food?") is not a purchase to try.
 */
export function parseAskedAmount(message: string): AskedAmount | null {
  if (!AFFORD.test(message)) return null;
  const toMinor = (whole: string, fraction?: string) =>
    decimalToMinor(`${whole.replace(/,/g, '')}${fraction ?? ''}`);
  const before = TAGGED_BEFORE.exec(message);
  if (before)
    return {
      amountMinor: toMinor(before[2], before[3]),
      currency: CURRENCY_TOKENS[before[1].toLowerCase()],
    };
  const after = TAGGED_AFTER.exec(message);
  if (after)
    return {
      amountMinor: toMinor(after[1], after[2]),
      currency: CURRENCY_TOKENS[after[3].toLowerCase()],
    };
  const bare = BARE.exec(message);
  return bare ? { amountMinor: toMinor(bare[1], bare[2]), currency: null } : null;
}

function recurringFact(s: RecurringSeries): RecurringFact {
  return {
    name: s.label,
    kind: s.kind,
    cadence: s.cadence,
    amount: minorToNumber(s.expectedAmountMinor),
    lastDate: dayKey(s.lastDay),
    nextDate: dayKey(s.nextExpectedDay),
    occurrences: s.occurrences,
    confidence: s.confidence,
    needsConfirm: s.needsConfirm,
  };
}

export function buildFinanceFactsByCurrency(
  input: FinanceFactsInput,
  now: Date = new Date(),
): Record<string, FinanceFacts> {
  const transactions = input.transactions.filter((tx) => new Date(tx.transactionDate) <= now);
  const series = detectRecurring(transactions, input.overrides, now, input.categoryNames);
  const currencies = new Set([
    ...transactions.map((tx) => tx.currency),
    ...input.wallets.filter((w) => w.isActive).map((w) => w.currency),
  ]);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  const facts: Record<string, FinanceFacts> = {};
  for (const currency of [...currencies].sort()) {
    const own = series.filter((s) => s.currency === currency);
    const payday = pickPayday(own);
    const liquid = liquidWallets(input.wallets, currency);
    const current = balanceMinor(liquid, transactions, now);
    const asked = input.askedAmount;
    facts[currency] = {
      balances: liquid.length
        ? {
            liquid: minorToNumber(current),
            changeLast30Days: minorToNumber(current - balanceMinor(liquid, transactions, monthAgo)),
            walletCount: liquid.length,
          }
        : null,
      recurring: [...own]
        .sort(
          (a, b) =>
            Number(b.type === 'income') - Number(a.type === 'income') ||
            b.expectedAmountMinor - a.expectedAmountMinor,
        )
        .slice(0, MAX_RECURRING)
        .map(recurringFact),
      payday: payday
        ? {
            name: payday.label,
            amount: minorToNumber(payday.expectedAmountMinor),
            cadence: payday.cadence,
            nextDate: dayKey(payday.nextExpectedDay),
          }
        : null,
      forecast: forecastCurrency({
        currency,
        wallets: input.wallets,
        transactions,
        series: own,
        payday,
        now,
        extraSpendMinor:
          asked && (asked.currency === null || asked.currency === currency)
            ? asked.amountMinor
            : null,
      }),
    };
  }
  return facts;
}
