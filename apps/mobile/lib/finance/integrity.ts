import { batch, observable } from '@legendapp/state';
import { decimalToMinor } from '@repo/types';
import {
  categoryBudgets$,
  debtActivities$,
  debts$,
  proposedTransactions$,
  transactions$,
  wallets$,
} from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { normalizeCurrency } from './money';

export type FinanceIntegrityIssue = {
  table:
    | 'wallets'
    | 'transactions'
    | 'category_budgets'
    | 'debt_activities'
    | 'proposed_transactions'
    | 'debts';
  id: string;
  field: string;
  reason: string;
  repairable: boolean;
};

/** Diagnostics are ephemeral and intentionally separate from read selectors. */
export const financeIntegrityIssues$ = observable<FinanceIntegrityIssue[]>([]);

function invalidAmount(value: unknown): boolean {
  try {
    decimalToMinor(value as string | number | null | undefined);
    return false;
  } catch {
    return true;
  }
}

function inspectAmountRows(
  table: FinanceIntegrityIssue['table'],
  rows: Array<{
    id: string;
    amount?: unknown;
    initial_balance?: unknown;
  }>,
  field: 'amount' | 'initial_balance',
): FinanceIntegrityIssue[] {
  return rows.flatMap((row) => {
    const value = field === 'amount' ? row.amount : row.initial_balance;
    return invalidAmount(value)
      ? [
          {
            table,
            id: row.id,
            field,
            reason: 'Invalid DECIMAL(12,2) value',
            repairable: false,
          },
        ]
      : [];
  });
}

/** Pure audit; calling it never changes synced rows. */
export function inspectFinanceIntegrity(): FinanceIntegrityIssue[] {
  const issues: FinanceIntegrityIssue[] = [
    ...inspectAmountRows('wallets', getRecordValues(wallets$), 'initial_balance'),
    ...inspectAmountRows('transactions', getRecordValues(transactions$), 'amount'),
    ...inspectAmountRows('category_budgets', getRecordValues(categoryBudgets$), 'amount'),
    ...inspectAmountRows('debt_activities', getRecordValues(debtActivities$), 'amount'),
    ...inspectAmountRows(
      'proposed_transactions',
      getRecordValues<{ id: string; amount?: unknown }>(proposedTransactions$).filter(
        (row) => row.amount != null,
      ),
      'amount',
    ),
  ];
  for (const debt of getRecordValues<{
    id: string;
    currency?: unknown;
  }>(debts$)) {
    if (!/^[A-Z]{3}$/.test(String(debt.currency ?? ''))) {
      issues.push({
        table: 'debts',
        id: debt.id,
        field: 'currency',
        reason: 'Missing or invalid ISO currency',
        repairable: true,
      });
    }
  }
  return issues;
}

/**
 * Runs only after a completed Legend sync. It repairs the one deterministic
 * legacy case (debt currency inferred from its cash wallet) and records all
 * other malformed values for support rather than silently treating them as 0.
 */
export function repairFinanceIntegrity(): FinanceIntegrityIssue[] {
  const issues = inspectFinanceIntegrity();
  const walletCurrency = new Map(
    getRecordValues<{ id: string; currency?: unknown }>(wallets$).map((wallet) => [
      wallet.id,
      normalizeCurrency(wallet.currency),
    ]),
  );
  const activities = getRecordValues<{
    debt_id?: string | null;
    wallet_id?: string | null;
  }>(debtActivities$);
  batch(() => {
    for (const issue of issues) {
      if (issue.table !== 'debts' || !issue.repairable) continue;
      const currency = activities
        .filter((activity) => activity.debt_id === issue.id && activity.wallet_id)
        .map((activity) => walletCurrency.get(activity.wallet_id!))
        .find((value): value is ReturnType<typeof normalizeCurrency> => Boolean(value));
      if (currency)
        patchRow(debts$, issue.id, {
          currency,
          updated_at: new Date().toISOString(),
        });
    }
  });
  const remaining = inspectFinanceIntegrity().filter(
    (issue) => !(issue.table === 'debts' && issue.repairable),
  );
  financeIntegrityIssues$.set(remaining);
  return remaining;
}
