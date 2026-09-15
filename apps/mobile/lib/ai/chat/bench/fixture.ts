/**
 * Fixed ledger for the offline chat bench: MYR, SGD and USD, rent on day 1, a refund,
 * an own-account transfer, budgets and one unreviewed proposal. Dates are device-local.
 */
import { decimalToMinor } from '@repo/types';
import {
  buildFinanceAssistantToolSnapshotByCurrency,
  type BudgetRow,
  type FinanceAssistantToolSnapshot,
  type ProposalForMetrics,
  type TxForMetrics,
} from '@/lib/ai/snapshot/finance-metrics';

export const BENCH_NOW = new Date(2026, 9, 12, 10, 0);

export const BENCH_CATEGORIES: Record<string, string> = {
  housing: 'Housing',
  groceries: 'Groceries',
  food: 'Food & Drink',
  transport: 'Transport',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  salary: 'Salary',
  refunds: 'Refunds',
};

function tx(
  date: [month: number, day: number],
  currency: string,
  type: TxForMetrics['type'],
  amount: string,
  categoryId: string | null,
  merchant: string | null,
): TxForMetrics {
  return {
    amountMinor: decimalToMinor(amount),
    currency,
    type,
    analysisExcluded: false,
    categoryId,
    merchant,
    transactionDate: new Date(2026, date[0] - 1, date[1], 9, 0).toISOString(),
  };
}

export const BENCH_TRANSACTIONS: TxForMetrics[] = [
  tx([9, 1], 'MYR', 'expense', '1500', 'housing', 'Landlord'),
  tx([9, 14], 'MYR', 'expense', '210.60', 'groceries', 'Jaya Grocer'),
  tx([9, 20], 'MYR', 'expense', '40', 'transport', 'Grab'),
  tx([9, 25], 'MYR', 'income', '4500', 'salary', 'Acme Sdn Bhd'),
  tx([10, 1], 'MYR', 'expense', '1500', 'housing', 'Landlord'),
  tx([10, 3], 'MYR', 'expense', '186.40', 'groceries', 'Jaya Grocer'),
  tx([10, 5], 'MYR', 'expense', '23.50', 'transport', 'Grab'),
  tx([10, 6], 'MYR', 'expense', '89.90', 'shopping', 'Lazada'),
  tx([10, 8], 'MYR', 'income', '89.90', 'refunds', 'Lazada'),
  tx([10, 9], 'MYR', 'transfer', '500', null, null),
  tx([10, 10], 'MYR', 'expense', '55', 'entertainment', 'Netflix'),
  tx([10, 11], 'MYR', 'expense', '18', 'food', 'Mamak Corner'),
  tx([9, 18], 'SGD', 'expense', '59.90', 'shopping', 'Uniqlo'),
  tx([10, 4], 'SGD', 'expense', '6.50', 'food', 'Ya Kun'),
  tx([10, 7], 'SGD', 'expense', '12', 'transport', 'SimplyGo'),
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

export function buildBenchSnapshot(): FinanceAssistantToolSnapshot {
  return buildFinanceAssistantToolSnapshotByCurrency(
    BENCH_TRANSACTIONS,
    BENCH_CATEGORIES,
    BENCH_BUDGETS,
    BENCH_PROPOSALS,
    BENCH_NOW,
  );
}
