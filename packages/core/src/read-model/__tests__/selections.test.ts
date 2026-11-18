import { describe, expect, it } from 'vitest';

import { createCalendar } from '../../calendar';
import { projectFinance } from '../projection';
import {
  budgetProgress,
  debtsWithBalance,
  filterTransactions,
  netWorthByCurrency,
  walletBalance,
  walletsForUser,
} from '../selections';

const KL = createCalendar('Asia/Kuala_Lumpur');

const wallet = (id: string, initial: string, currency = 'MYR') => ({
  id,
  user_id: 'kai',
  name: id,
  type: 'bank',
  currency,
  initial_balance: initial,
  is_active: true,
  display_order: 0,
});

const tx = (id: string, date: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: 'kai',
  wallet_id: 'maybank',
  type: 'expense',
  amount: '10.00',
  currency: 'MYR',
  transaction_date: date,
  ...over,
});

const projection = projectFinance({
  wallets: {
    maybank: wallet('maybank', '1000.00'),
    tng: wallet('tng', '50.00'),
    wise: wallet('wise', '200.00', 'USD'),
    closed: { ...wallet('closed', '999.00'), deleted: true },
  },
  transactions: {
    // Stored out of date order: the index still reads newest first.
    lunch: tx('lunch', '2026-10-14T12:30:00+08:00', { amount: '18.90', category_id: 'food' }),
    salary: tx('salary', '2026-10-01T09:00:00+08:00', { type: 'income', amount: '4200.00' }),
    reload: tx('reload', '2026-10-10T08:00:00+08:00', {
      type: 'transfer',
      amount: '100.00',
      transfer_to_wallet_id: 'tng',
    }),
    groceries: tx('groceries', '2026-10-12T18:00:00+08:00', { amount: '120.00', category_id: 'food' }),
    refunded: tx('refunded', '2026-10-13T10:00:00+08:00', { amount: '500.00', deleted: true }),
    september: tx('september', '2026-09-30T23:30:00+08:00', { amount: '30.00', category_id: 'food' }),
  },
  categories: {
    food: { id: 'food', user_id: null, name: 'Food & Dining', type: 'expense', is_active: true },
  },
  budgets: {
    b1: { id: 'b1', user_id: 'kai', category_id: 'food', currency: 'MYR', amount: '180.00' },
  },
  debts: {
    mei: { id: 'mei', user_id: 'kai', counterparty_name: 'Mei', direction: 'i_owe', currency: 'MYR' },
    aiman: {
      id: 'aiman',
      user_id: 'kai',
      counterparty_name: 'Aiman',
      direction: 'owed_to_me',
      currency: 'MYR',
    },
  },
  debtActivities: {
    a1: { id: 'a1', debt_id: 'mei', kind: 'principal', amount: '300.00', activity_date: '2026-10-02' },
    a2: { id: 'a2', debt_id: 'mei', kind: 'repayment', amount: '50.00', activity_date: '2026-10-09' },
    a3: { id: 'a3', debt_id: 'aiman', kind: 'principal', amount: '80.00', activity_date: '2026-10-03' },
  },
  proposals: {},
});

const transactionsOf = (walletId: string) =>
  (projection.transactionsByWallet[walletId] ?? []).map((id) => projection.transactionsById[id]!);

const balances = Object.fromEntries(
  walletsForUser(projection.walletsById, 'kai').map((each) => [
    each.id,
    walletBalance(each, transactionsOf(each.id)),
  ]),
);

const debts = debtsWithBalance(projection.debtsById, 'kai', (debtId) =>
  (projection.debtActivityIdsByDebt[debtId] ?? []).map((id) => projection.debtActivitiesById[id]!),
);

describe('the finance read model from synced rows', () => {
  it('leaves soft-deleted rows out and indexes each wallet newest first', () => {
    expect(Object.keys(projection.walletsById).sort()).toEqual(['maybank', 'tng', 'wise']);
    expect(projection.transactionsById.refunded).toBeUndefined();
    expect(projection.transactionsByWallet).toEqual({
      maybank: ['lunch', 'groceries', 'reload', 'salary', 'september'],
      tng: ['reload'],
    });
  });

  it('moves each wallet by its own transactions, a transfer on both sides', () => {
    expect(balances).toEqual({ maybank: 493110, tng: 15000, wise: 20000 });
  });

  it('nets cash against debts per currency', () => {
    expect(netWorthByCurrency(walletsForUser(projection.walletsById, 'kai'), balances, debts)).toEqual([
      { currency: 'MYR', cashMinor: 508110, receivableMinor: 8000, payableMinor: 25000, netWorthMinor: 491110 },
      { currency: 'USD', cashMinor: 20000, receivableMinor: 0, payableMinor: 0, netWorthMinor: 20000 },
    ]);
  });

  it("counts this month's spending against the budget, near the limit from 75%", () => {
    expect(
      budgetProgress({
        categoriesById: projection.categoriesById,
        budgetsById: projection.budgetsById,
        transactions: filterTransactions(Object.values(projection.transactionsById), { userId: 'kai' }),
        userId: 'kai',
        calendar: KL,
        now: new Date('2026-10-14T20:00:00+08:00'),
      }),
    ).toEqual([
      {
        categoryId: 'food',
        categoryName: 'Food & Dining',
        categoryIcon: null,
        categoryColor: null,
        categoryIsActive: true,
        currency: 'MYR',
        budgetAmountMinor: 18000,
        spentMinor: 13890,
        remainingMinor: 4110,
        percentage: 77.2,
        status: 'near_limit',
      },
    ]);
  });

  it("reads the month in the calendar's zone", () => {
    const [food] = budgetProgress({
      categoriesById: projection.categoriesById,
      budgetsById: projection.budgetsById,
      transactions: filterTransactions(Object.values(projection.transactionsById), { userId: 'kai' }),
      userId: 'kai',
      calendar: createCalendar('Pacific/Kiritimati'),
      now: new Date('2026-10-14T20:00:00+08:00'),
    });
    expect([food?.spentMinor, food?.percentage, food?.status]).toEqual([16890, 93.8, 'near_limit']);
  });
});
