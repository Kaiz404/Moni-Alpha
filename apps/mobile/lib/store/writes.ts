/**
 * The phone's side of `@repo/core`'s write plans: the ledger a plan reads, who writes and when, and
 * the one applier that carries the writes out on the store.
 */
import {
  toFinanceDebt,
  toFinanceDebtActivity,
  toFinanceTransaction,
  toFinanceWallet,
  type LedgerView,
  type PlanContext,
  type Planned,
} from '@repo/core';
import { applyWrites } from '@repo/data';
import { randomUUID } from 'expo-crypto';

import {
  autoAddRules$,
  categories$,
  categoryBudgets$,
  debtActivities$,
  debts$,
  isMigrated,
  merchantAliases$,
  proposedTransactions$,
  recurringOverrides$,
  tags$,
  transactions$,
  transactionTags$,
  wallets$,
} from '@/lib/store';
import { getUserId } from '@/lib/supabase/client';

type Rows = Record<string, Record<string, unknown>> | null | undefined;

function byId<T extends { id: string }>(rows: Rows, adapt: (row: Record<string, unknown>) => T | null) {
  const out: Record<string, T> = {};
  for (const row of Object.values(rows ?? {})) {
    const item = row && typeof row === 'object' ? adapt(row) : null;
    if (item) out[item.id] = item;
  }
  return out;
}

/** The live ledger as it is right now, read with no await so a check and its write see one state. */
export function ledgerView(): LedgerView {
  return {
    walletsById: byId(wallets$.peek() as Rows, toFinanceWallet),
    transactionsById: byId(transactions$.peek() as Rows, toFinanceTransaction),
    debtsById: byId(debts$.peek() as Rows, toFinanceDebt),
    debtActivitiesById: byId(debtActivities$.peek() as Rows, toFinanceDebtActivity),
  };
}

export async function planContext(): Promise<PlanContext> {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');
  return { userId, now: new Date().toISOString(), newId: randomUUID, isMigrated };
}

/** Writes what the plan says, or throws the reason it could not. */
export function commit<Result>(plan: Planned<Result>): Result {
  if (plan.kind === 'error') throw new Error(plan.message);
  if (plan.kind === 'needsInput') {
    throw new Error(plan.field === 'wallet' ? 'Select a wallet' : 'Select the wallet it went to');
  }
  applyWrites(
    {
      tables: {
        wallets: wallets$,
        transactions: transactions$,
        categories: categories$,
        tags: tags$,
        transaction_tags: transactionTags$,
        category_budgets: categoryBudgets$,
        debts: debts$,
        debt_activities: debtActivities$,
        proposed_transactions: proposedTransactions$,
        recurring_overrides: recurringOverrides$,
        auto_add_rules: autoAddRules$,
        merchant_aliases: merchantAliases$,
      },
    },
    plan.writes,
  );
  return plan.result;
}
