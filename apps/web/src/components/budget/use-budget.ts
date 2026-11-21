'use client';

import {
  buildMoneyMonth,
  countsAsSpending,
  isMonthKey,
  lastPaymentBySeries,
  pendingProposals,
  spendByMonth,
  firstSpendMonth,
  spendMonths,
  spendSlices,
  type FinanceTransaction,
  type MonthKey,
} from '@repo/core';
import { useMemo } from 'react';
import { budgetTable } from '@/lib/budget-view';
import type { Ledger } from '@/lib/ledger/use-ledger';

/** Months of history the category pane draws, this one included. */
export const HISTORY_MONTHS = 6;

/** Everything the Budget screen reads for one month, from `@repo/core`'s money month and read model. */
export function useBudget(source: Ledger, requested: string | null, setup: boolean) {
  const { projection, userId, calendar, now, currency, money: ledger, walletNames } = source;
  const current = calendar.monthKey(now);
  const month: MonthKey = requested && isMonthKey(requested) && requested <= current ? requested : current;

  return useMemo(() => {
    const money = buildMoneyMonth(ledger, { month, currency, now, calendar });
    const history = spendByMonth(ledger.transactions, { month, count: HISTORY_MONTHS, currency, calendar });
    const table = budgetTable(money, history, setup ? ledger.categories : null);
    const everyCategory = Object.values(projection.categoriesById);
    const slices = spendSlices(ledger.transactions, month, currency, everyCategory, calendar);
    const monthSpend = (categoryId: string): FinanceTransaction[] =>
      ledger.transactions
        .filter(
          (transaction) =>
            transaction.categoryId === categoryId &&
            transaction.currency === currency &&
            countsAsSpending(transaction) &&
            calendar.monthKey(transaction.transactionDate) === month,
        )
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    const toReview = pendingProposals(projection.proposalsById, userId);
    const latest = lastPaymentBySeries(ledger.transactions);
    return {
      month,
      current,
      money,
      history,
      table,
      slices,
      walletNames,
      monthSpend,
      toReview,
      billLook: (seriesKey: string) => {
        const payment = latest.get(seriesKey);
        const category = payment?.categoryId ? projection.categoriesById[payment.categoryId] : undefined;
        return {
          wallet: payment ? (walletNames[payment.walletId] ?? null) : null,
          icon: category?.icon ?? null,
          color: category?.color ?? null,
        };
      },
      months: spendMonths(ledger.transactions, currency, now, calendar),
      firstMonth: firstSpendMonth(ledger.transactions, currency, now, calendar),
      hasBudgets: money.budgeted.length > 0,
      ledger,
    };
  }, [ledger, month, current, currency, now, calendar, setup, projection, userId, walletNames]);
}

export type BudgetData = ReturnType<typeof useBudget>;
