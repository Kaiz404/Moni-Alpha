'use client';

import {
  describeDebt,
  summarizeDebts,
  type DebtLine,
  type FinanceDebtActivity,
} from '@repo/core';
import { useMemo } from 'react';
import type { Ledger } from '@/lib/ledger/use-ledger';

/** The Debts tab from the read model: the main currency's summary, every line, and the wallets a debt can move. */
export function useDebts(ledger: Ledger) {
  const { projection, userId, now, currency, calendar, wallets, walletNames, defaultWalletId: preferredId } = ledger;
  return useMemo(() => {
    const debts = Object.values(projection.debtsById).filter((debt) => debt.userId === userId);
    const activities = Object.values(projection.debtActivitiesById);
    const summary = summarizeDebts(debts, activities, now, currency, calendar);
    const byDebt = new Map<string, FinanceDebtActivity[]>();
    for (const activity of activities) byDebt.set(activity.debtId, [...(byDebt.get(activity.debtId) ?? []), activity]);
    const allLines = debts
      .map((debt) => describeDebt(debt, byDebt.get(debt.id) ?? []))
      .filter((line): line is DebtLine => line !== null);
    const preferred = wallets.find((wallet) => wallet.id === preferredId);
    const people = [...new Map(allLines.map((line) => [line.debt.counterpartyName.trim().toLocaleLowerCase(), line.debt.counterpartyName.trim()])).values()];
    return {
      summary,
      allLines,
      wallets,
      walletNames,
      defaultWalletId: (preferred ?? wallets.find((wallet) => wallet.currency === currency) ?? wallets[0])?.id ?? null,
      people,
      activitiesOf: (debtId: string) => byDebt.get(debtId) ?? [],
    };
  }, [projection, userId, now, currency, calendar, wallets, walletNames, preferredId]);
}

export type DebtsData = ReturnType<typeof useDebts>;
