import { debtActivities$, debts$, transactions$ } from '@/lib/store';
import { deleteDebt } from '@/lib/supabase/debts';
import type { Debt } from '@repo/types';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-id' }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'kai' }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    tags$: observable({}),
    transactionTags$: observable({}),
    categoryBudgets$: observable({}),
    debts$: observable({}),
    debtActivities$: observable({}),
    proposedTransactions$: observable({}),
    recurringOverrides$: observable({}),
    autoAddRules$: observable({}),
    merchantAliases$: observable({}),
    isMigrated: () => true,
  };
});

const THEN = '2026-10-01T00:00:00.000Z';

const debtRow = {
  id: 'debt-1',
  user_id: 'kai',
  counterparty_name: 'Aiman',
  direction: 'owed_to_me',
  currency: 'MYR',
  due_date: null,
  note: null,
  status: 'open',
  deleted: false,
  created_at: THEN,
  updated_at: THEN,
};

const activityRow = (id: string, kind: string, amount: string) => ({
  id,
  user_id: 'kai',
  debt_id: 'debt-1',
  kind,
  amount,
  activity_date: THEN,
  wallet_id: 'maybank',
  cash_transaction_id: `cash-${id}`,
  note: null,
  deleted: false,
  created_at: THEN,
  updated_at: THEN,
});

const cashRow = (id: string, activityId: string | null, type: string, amount: string) => ({
  id,
  user_id: 'kai',
  wallet_id: 'maybank',
  amount,
  currency: 'MYR',
  type,
  debt_activity_id: activityId,
  analysis_excluded: activityId !== null,
  transaction_date: THEN,
  deleted: false,
  created_at: THEN,
  updated_at: THEN,
});

const live = (rows: Record<string, { deleted?: boolean }> | undefined) =>
  Object.entries(rows ?? {})
    .filter(([, row]) => !row.deleted)
    .map(([id]) => id);

beforeEach(() => {
  debts$.set({ 'debt-1': debtRow } as never);
  debtActivities$.set({
    a1: activityRow('a1', 'principal', '100.00'),
    a2: activityRow('a2', 'repayment', '25.00'),
  } as never);
  transactions$.set({
    'cash-a1': cashRow('cash-a1', 'a1', 'expense', '100.00'),
    'cash-a2': cashRow('cash-a2', 'a2', 'income', '25.00'),
    lunch: cashRow('lunch', null, 'expense', '12.00'),
  } as never);
});

describe('deleteDebt', () => {
  it('removes the debt, its entries and their wallet rows in one go, and Undo brings them all back', () => {
    const undo = deleteDebt({ id: 'debt-1', direction: 'owed_to_me', counterpartyName: 'Aiman' } as Debt);

    expect([live(debts$.peek()), live(debtActivities$.peek()), live(transactions$.peek())]).toEqual([[], [], ['lunch']]);

    undo();

    expect([live(debts$.peek()), live(debtActivities$.peek()), live(transactions$.peek())]).toEqual([
      ['debt-1'],
      ['a1', 'a2'],
      ['cash-a1', 'cash-a2', 'lunch'],
    ]);
    expect(transactions$['cash-a1'].peek()).toMatchObject({ amount: '100.00', type: 'expense', debt_activity_id: 'a1' });
  });
});
