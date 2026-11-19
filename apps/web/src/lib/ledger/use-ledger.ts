'use client';

import { syncState } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import {
  buildMoneyMonth,
  compactWalletNames,
  createCalendar,
  debtsWithBalance,
  merchantAliasesFromRows,
  moneyLedger,
  pendingProposals,
  projectFinance,
  recurringOverridesFromRows,
  reviewedLately,
  toProposal,
  walletBalance,
  walletsForUser,
  type BudgetRow,
  type Calendar,
  type FinanceProjection,
  type FinanceProposal,
  type FinanceTransaction,
  type FinanceWallet,
  type MoneyLedger,
  type MoneyLedgerRows,
  type MoneyMonth,
  type RawTable,
  type ReviewedProposal,
} from '@repo/core';
import type { CurrencyCode, MerchantAlias, MinorAmount } from '@repo/types';
import { useEffect, useMemo, useState } from 'react';
import { useShellApi } from '@/components/shell/shell-context';
import { moniStore } from '@/lib/moni-store';

export type Ledger = {
  /** False until the first pull lands, so a screen shows its loading blocks rather than empty states. */
  loaded: boolean;
  /** False on the server and in the first browser render, before the clock is read. */
  mounted: boolean;
  userId: string;
  currency: CurrencyCode;
  now: Date;
  calendar: Calendar;
  projection: FinanceProjection;
  /** The user's rows, every currency, newest first. */
  transactions: FinanceTransaction[];
  /** Active wallets in the user's order. */
  wallets: FinanceWallet[];
  balances: Record<string, MinorAmount>;
  walletNames: Record<string, string>;
  aliases: MerchantAlias[];
  /** What `money` was read from, for Moni chat's snapshots. */
  moneyRows: MoneyLedgerRows;
  money: MoneyLedger;
  /** This month in the main currency. */
  month: MoneyMonth;
  /** Captures waiting for a decision, newest first. */
  waiting: FinanceProposal[];
  /** Recently reviewed: the last 30 days of Approve and Not mine, newest first. */
  reviewed: ReviewedProposal[];
  /** Budget rows as stored, soft-deleted ones included, for the budget plans. */
  budgetRows: BudgetRow[];
  /** The wallet the profile picks for new entries, if any. */
  defaultWalletId: string | null;
  /** First-run set-up: when it finished, and whether Home's Get set up card was closed. */
  setup: { finishedAt?: string; hidden?: boolean };
};

const EMPTY: Record<string, never> = {};

/** Every table a screen reads, copied so a change in place still gives React a new reference. */
function useTables() {
  return useValue(() => {
    if (typeof window === 'undefined') return null;
    const store = moniStore();
    const copy = (table$: { get(): unknown }) => ({ ...((table$.get() as RawTable | undefined) ?? EMPTY) });
    return {
      loaded: [store.wallets$, store.transactions$, store.categories$, store.categoryBudgets$, store.debts$, store.debtActivities$, store.proposedTransactions$].every(
        (table$) => syncState(table$).isLoaded.get(),
      ),
      wallets: copy(store.wallets$),
      transactions: copy(store.transactions$),
      categories: copy(store.categories$),
      budgets: copy(store.categoryBudgets$),
      debts: copy(store.debts$),
      debtActivities: copy(store.debtActivities$),
      proposals: copy(store.proposedTransactions$),
      overrides: copy(store.recurringOverrides$),
      aliases: copy(store.merchantAliases$),
      monthlyBudget: store.profilePreferences$.get()?.monthly_budget ?? null,
      defaultWalletId: store.profilePreferences$.get()?.default_wallet_id ?? null,
      setupFinishedAt: store.profilePreferences$.get()?.setup_finished_at,
      setupHidden: store.profilePreferences$.get()?.setup_checklist_hidden,
    };
  });
}

/** The clock screens read: a new minute re-renders them, so Today rolls over at midnight. */
export function useNow(): Date | null {
  // Null until the page has hydrated, so it matches the server's HTML whatever the two clocks say.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** The shared read model over the synced store, for the signed-in user in their main currency. */
export function useLedger(): Ledger {
  const { user } = useShellApi();
  const clock = useNow();
  const synced = useTables();
  const tables = clock ? synced : null;
  const currency = user.currency as CurrencyCode;
  const calendar = useMemo(() => {
    try {
      return createCalendar(user.zone ?? browserZone());
    } catch {
      return createCalendar(browserZone());
    }
  }, [user.zone]);

  return useMemo(() => {
    const now = clock ?? new Date(0);
    const projection = tables
      ? projectFinance({
          wallets: tables.wallets,
          transactions: tables.transactions,
          categories: tables.categories,
          budgets: tables.budgets,
          debts: tables.debts,
          debtActivities: tables.debtActivities,
          proposals: tables.proposals,
        })
      : projectFinance({ wallets: {}, transactions: {}, categories: {}, budgets: {}, debts: {}, debtActivities: {}, proposals: {} });
    const transactions = Object.values(projection.transactionsById)
      .filter((transaction) => transaction.userId === user.id)
      .sort((a, b) => Date.parse(b.transactionDate) - Date.parse(a.transactionDate));
    const wallets = walletsForUser(projection.walletsById, user.id);
    const balances: Record<string, MinorAmount> = {};
    for (const wallet of wallets) {
      const ids = projection.transactionsByWallet[wallet.id] ?? [];
      balances[wallet.id] = walletBalance(
        wallet,
        ids.map((id) => projection.transactionsById[id]!).filter(Boolean),
      );
    }
    const moneyRows: MoneyLedgerRows = {
      userId: user.id,
      transactions,
      categoriesById: projection.categoriesById,
      budgetsById: projection.budgetsById,
      monthlyBudget: tables?.monthlyBudget ?? null,
      overrides: recurringOverridesFromRows(tables?.overrides ?? {}, user.id),
      debts: debtsWithBalance(projection.debtsById, user.id, (debtId) =>
        (projection.debtActivityIdsByDebt[debtId] ?? []).map((id) => projection.debtActivitiesById[id]!),
      ),
    };
    const money = moneyLedger(moneyRows, now, calendar);
    return {
      loaded: (tables?.loaded ?? false) && clock !== null,
      mounted: clock !== null,
      userId: user.id,
      currency,
      now,
      calendar,
      projection,
      transactions,
      wallets,
      balances,
      walletNames: compactWalletNames(Object.values(projection.walletsById)),
      aliases: merchantAliasesFromRows(tables?.aliases ?? {}, user.id),
      moneyRows,
      money,
      month: buildMoneyMonth(money, { month: calendar.monthKey(now), currency, now, calendar }),
      waiting: pendingProposals(projection.proposalsById, user.id),
      reviewed: reviewedLately(
        Object.values(tables?.proposals ?? EMPTY).flatMap((row) => {
          const proposal = row ? toProposal(row as Parameters<typeof toProposal>[0]) : null;
          return proposal && proposal.userId === user.id ? [proposal] : [];
        }),
        now,
      ),
      budgetRows: Object.values(tables?.budgets ?? EMPTY).filter(Boolean) as BudgetRow[],
      defaultWalletId: tables?.defaultWalletId ?? null,
      setup: { finishedAt: tables?.setupFinishedAt, hidden: tables?.setupHidden },
    };
  }, [tables, clock, calendar, currency, user.id]);
}
