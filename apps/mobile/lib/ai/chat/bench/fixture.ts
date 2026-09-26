/**
 * Fixed ledgers for the offline chat bench, dates device-local:
 * - default: MYR, SGD and USD, rent on day 1, a refund, an own-account transfer, budgets and one
 *   unreviewed proposal. MYR has three months of salary, rent and Netflix and recently confirmed
 *   balances; SGD's balance is stale; USD is irregular freelance income.
 * - salaried: a year of daily MYR spending, salary on the 25th, rent, bills and subscriptions,
 *   one confirmed bank balance.
 * - gig: weekly ride-hailing payouts that swing widely and no regular payday.
 */
import { decimalToMinor } from '@repo/types';
import {
  buildFinanceFactsByCurrency,
  parseAskedAmount,
  type FactsTransaction,
  type FactsWallet,
} from '@/lib/ai/facts';
import {
  buildFinanceAssistantToolSnapshotByCurrency,
  type BudgetRow,
  type FinanceAssistantToolSnapshot,
  type ProposalForMetrics,
} from '@/lib/ai/snapshot/finance-metrics';

export const BENCH_NOW = new Date(2026, 9, 12, 10, 0);

export const BENCH_CATEGORIES: Record<string, string> = {
  housing: 'Housing',
  groceries: 'Groceries',
  food: 'Food & Drink',
  transport: 'Transport',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  utilities: 'Utilities',
  salary: 'Salary',
  freelance: 'Freelance',
  refunds: 'Refunds',
};

const WALLET_OF: Record<string, string> = { MYR: 'maybank', SGD: 'dbs', USD: 'wise' };

const daysAgo = (days: number) => new Date(BENCH_NOW.getTime() - days * 86_400_000).toISOString();

export const BENCH_WALLETS: FactsWallet[] = [
  {
    id: 'maybank',
    type: 'bank',
    currency: 'MYR',
    initialBalanceMinor: decimalToMinor('1800'),
    isActive: true,
    balanceConfirmedAt: daysAgo(7),
  },
  {
    id: 'tng',
    type: 'ewallet',
    currency: 'MYR',
    initialBalanceMinor: decimalToMinor('150'),
    isActive: true,
    balanceConfirmedAt: daysAgo(7),
  },
  {
    id: 'dbs',
    type: 'bank',
    currency: 'SGD',
    initialBalanceMinor: decimalToMinor('500'),
    isActive: true,
    balanceConfirmedAt: daysAgo(45),
  },
  {
    id: 'wise',
    type: 'bank',
    currency: 'USD',
    initialBalanceMinor: decimalToMinor('200'),
    isActive: true,
    balanceConfirmedAt: daysAgo(10),
  },
];

function tx(
  date: [month: number, day: number],
  currency: string,
  type: FactsTransaction['type'],
  amount: string,
  categoryId: string | null,
  merchant: string | null,
  transferToWalletId: string | null = null,
): FactsTransaction {
  return {
    walletId: WALLET_OF[currency],
    transferToWalletId,
    amountMinor: decimalToMinor(amount),
    currency,
    type,
    analysisExcluded: false,
    debtActivityId: null,
    categoryId,
    merchant,
    transactionDate: new Date(2026, date[0] - 1, date[1], 9, 0).toISOString(),
  };
}

export const BENCH_TRANSACTIONS: FactsTransaction[] = [
  tx([7, 1], 'MYR', 'expense', '1500', 'housing', 'Landlord'),
  tx([7, 10], 'MYR', 'expense', '55', 'entertainment', 'Netflix'),
  tx([7, 24], 'MYR', 'income', '4500', 'salary', 'Acme Sdn Bhd'),
  tx([8, 1], 'MYR', 'expense', '1500', 'housing', 'Landlord'),
  tx([8, 10], 'MYR', 'expense', '55', 'entertainment', 'Netflix'),
  tx([8, 25], 'MYR', 'income', '4500', 'salary', 'Acme Sdn Bhd'),
  tx([9, 1], 'MYR', 'expense', '1500', 'housing', 'Landlord'),
  tx([9, 10], 'MYR', 'expense', '55', 'entertainment', 'Netflix'),
  tx([9, 14], 'MYR', 'expense', '210.60', 'groceries', 'Jaya Grocer'),
  tx([9, 20], 'MYR', 'expense', '40', 'transport', 'Grab'),
  tx([9, 25], 'MYR', 'income', '4500', 'salary', 'Acme Sdn Bhd'),
  tx([10, 1], 'MYR', 'expense', '1500', 'housing', 'Landlord'),
  tx([10, 3], 'MYR', 'expense', '186.40', 'groceries', 'Jaya Grocer'),
  tx([10, 5], 'MYR', 'expense', '23.50', 'transport', 'Grab'),
  tx([10, 6], 'MYR', 'expense', '89.90', 'shopping', 'Lazada'),
  tx([10, 8], 'MYR', 'income', '89.90', 'refunds', 'Lazada'),
  tx([10, 9], 'MYR', 'transfer', '500', null, null, 'tng'),
  tx([10, 10], 'MYR', 'expense', '55', 'entertainment', 'Netflix'),
  tx([10, 11], 'MYR', 'expense', '18', 'food', 'Mamak Corner'),
  tx([9, 18], 'SGD', 'expense', '59.90', 'shopping', 'Uniqlo'),
  tx([10, 4], 'SGD', 'expense', '6.50', 'food', 'Ya Kun'),
  tx([10, 7], 'SGD', 'expense', '12', 'transport', 'SimplyGo'),
  tx([7, 3], 'USD', 'income', '300', 'freelance', 'Upwork'),
  tx([7, 29], 'USD', 'income', '120', 'freelance', 'Upwork'),
  tx([8, 21], 'USD', 'income', '450', 'freelance', 'Upwork'),
  tx([9, 2], 'USD', 'income', '80', 'freelance', 'Upwork'),
  tx([9, 30], 'USD', 'income', '260', 'freelance', 'Upwork'),
  tx([10, 2], 'USD', 'expense', '2.99', 'entertainment', 'iCloud'),
];

export const BENCH_BUDGETS: BudgetRow[] = [
  { categoryId: 'groceries', currency: 'MYR', amountMinor: decimalToMinor('600') },
  { categoryId: 'food', currency: 'MYR', amountMinor: decimalToMinor('300') },
  { categoryId: 'food', currency: 'SGD', amountMinor: decimalToMinor('100') },
];

export const BENCH_PROPOSALS: ProposalForMetrics[] = [
  { amountMinor: decimalToMinor('12'), currency: 'MYR', type: 'expense' },
];

/** Deterministic pseudo-random stream (mulberry32), so generated ledgers never drift. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ledger = { transactions: FactsTransaction[]; wallets: FactsWallet[] };

function ledgerBuilder(walletId: string, seed: number) {
  const next = random(seed);
  const transactions: FactsTransaction[] = [];
  return {
    transactions,
    pick: <T>(items: T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
    whole: (max: number) => Math.floor(next() * max),
    amount: (min: number, max: number) => (min + next() * (max - min)).toFixed(2),
    add(
      date: Date,
      type: FactsTransaction['type'],
      amount: string,
      categoryId: string,
      merchant: string,
    ) {
      transactions.push({
        walletId,
        transferToWalletId: null,
        amountMinor: decimalToMinor(amount),
        currency: 'MYR',
        type,
        analysisExcluded: false,
        debtActivityId: null,
        categoryId,
        merchant,
        transactionDate: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          9 + Math.floor(next() * 11),
        ).toISOString(),
      });
    },
  };
}

function eachDay(from: Date, to: Date, visit: (date: Date) => void): void {
  for (let d = new Date(from); d < to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
    visit(d);
}

/** Salary on the 25th, paid the Friday before when it falls on a weekend. */
function payday(year: number, month: number): Date {
  const date = new Date(year, month, 25);
  const shift = date.getDay() === 6 ? 1 : date.getDay() === 0 ? 2 : 0;
  return new Date(year, month, 25 - shift);
}

const singleWallet = (id: string, type: string, initial: string, confirmedDay: number) => [
  {
    id,
    type,
    currency: 'MYR',
    initialBalanceMinor: decimalToMinor(initial),
    isActive: true,
    balanceConfirmedAt: new Date(2026, 9, confirmedDay, 20).toISOString(),
  },
];

export function salariedLedger(): Ledger {
  const b = ledgerBuilder('maybank', 25);
  let nextGrocery = 3;
  eachDay(new Date(2025, 9, 1), BENCH_NOW, (date) => {
    const day = date.getDate();
    if (day === 1) b.add(date, 'expense', '1500', 'housing', 'Landlord');
    if (day === 3) b.add(date, 'expense', '17.90', 'entertainment', 'Spotify');
    if (day === 10) b.add(date, 'expense', '55', 'entertainment', 'Netflix');
    if (day === 15) b.add(date, 'expense', b.amount(88, 106), 'utilities', 'TNB');
    if (day === 18) b.add(date, 'expense', '129', 'utilities', 'Unifi');
    if (date.getTime() === payday(date.getFullYear(), date.getMonth()).getTime())
      b.add(date, 'income', '3800', 'salary', 'Acme Sdn Bhd');
    if (b.chance(0.9))
      b.add(
        date,
        'expense',
        b.amount(8, 32),
        'food',
        b.pick(['Mamak Corner', 'Nasi Kandar Pelita', 'Kopitiam', 'Sushi King', "McDonald's"]),
      );
    if (b.chance(0.3)) b.add(date, 'expense', b.amount(12, 30), 'transport', 'Grab');
    if (b.chance(0.05)) b.add(date, 'expense', b.amount(30, 160), 'shopping', 'Shopee');
    nextGrocery -= 1;
    if (nextGrocery === 0) {
      b.add(date, 'expense', b.amount(90, 190), 'groceries', b.pick(['Jaya Grocer', "Lotus's"]));
      nextGrocery = 6 + b.whole(4);
    }
  });
  b.add(new Date(2026, 7, 9), 'expense', '899', 'shopping', 'Courts');
  return { transactions: b.transactions, wallets: singleWallet('maybank', 'bank', '1200', 3) };
}

export function gigLedger(): Ledger {
  const b = ledgerBuilder('tng', 7);
  eachDay(new Date(2026, 5, 1), BENCH_NOW, (date) => {
    const day = date.getDate();
    if (day === 1) b.add(date, 'expense', '650', 'housing', 'Room rental');
    if (day === 5) b.add(date, 'expense', '48', 'utilities', 'Digi');
    if (date.getDay() === 1) b.add(date, 'income', b.amount(220, 680), 'freelance', 'Grab payout');
    if (b.chance(0.2)) b.add(date, 'income', b.amount(30, 160), 'freelance', 'Foodpanda payout');
    if (b.chance(0.45)) b.add(date, 'expense', b.amount(20, 50), 'transport', 'Petronas');
    if (b.chance(0.9))
      b.add(date, 'expense', b.amount(7, 22), 'food', b.pick(['Kopitiam', 'Mamak Corner']));
  });
  return { transactions: b.transactions, wallets: singleWallet('tng', 'ewallet', '600', 6) };
}

export type BenchFixture = 'default' | 'salaried' | 'gig';

/** The snapshot chat would send for `question`, built the same way as `analyze.ts`. */
export function buildBenchSnapshot(
  fixture: BenchFixture = 'default',
  question = '',
): FinanceAssistantToolSnapshot {
  const { transactions, wallets } =
    fixture === 'default'
      ? { transactions: BENCH_TRANSACTIONS, wallets: BENCH_WALLETS }
      : fixture === 'salaried'
        ? salariedLedger()
        : gigLedger();
  const facts = buildFinanceFactsByCurrency(
    {
      wallets,
      transactions,
      overrides: [],
      categoryNames: BENCH_CATEGORIES,
      askedAmount: parseAskedAmount(question),
    },
    BENCH_NOW,
  );
  const extras = fixture === 'default';
  return buildFinanceAssistantToolSnapshotByCurrency(
    transactions,
    BENCH_CATEGORIES,
    extras ? BENCH_BUDGETS : [],
    extras ? BENCH_PROPOSALS : [],
    BENCH_NOW,
    facts,
  );
}
