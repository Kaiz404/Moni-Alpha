import { decimalToMinor } from '@repo/types';
import { financeProjection$ } from '../projection';
import { transactions$, walletBalanceMinor$ } from '../selectors';
import type { FinanceProjection } from '../types';

it('keeps a 10k-transaction wallet query on its wallet index', () => {
  const transactionsById: FinanceProjection['transactionsById'] = {};
  const firstWalletIds: string[] = [];
  const secondWalletIds: string[] = [];
  for (let index = 0; index < 10_000; index += 1) {
    const walletId = index % 2 === 0 ? 'wallet_1' : 'wallet_2';
    const id = `transaction_${index}`;
    if (walletId === 'wallet_1') firstWalletIds.push(id);
    else secondWalletIds.push(id);
    transactionsById[id] = {
      id,
      userId: 'user_1',
      walletId,
      amountMinor: decimalToMinor('1'),
      currency: 'USD',
      type: 'expense',
      analysisExcluded: false,
      debtActivityId: null,
      categoryId: null,
      transferToWalletId: null,
      linkedTransactionId: null,
      description: null,
      merchant: null,
      notes: null,
      transactionDate: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      locationLatitude: null,
      locationLongitude: null,
      locationName: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }
  const projection: FinanceProjection = {
    walletsById: {
      wallet_1: {
        id: 'wallet_1',
        userId: 'user_1',
        name: 'Primary',
        type: 'bank',
        currency: 'USD',
        initialBalanceMinor: decimalToMinor('10000'),
        color: null,
        icon: null,
        cardStyleId: null,
        isActive: true,
        displayOrder: 0,
      },
      wallet_2: {
        id: 'wallet_2',
        userId: 'user_1',
        name: 'Secondary',
        type: 'bank',
        currency: 'USD',
        initialBalanceMinor: decimalToMinor('10000'),
        color: null,
        icon: null,
        cardStyleId: null,
        isActive: true,
        displayOrder: 1,
      },
    },
    transactionsById,
    transactionsByWallet: {
      wallet_1: firstWalletIds,
      wallet_2: secondWalletIds,
    },
    categoriesById: {},
    budgetsById: {},
    debtsById: {},
    debtActivitiesById: {},
    debtActivityIdsByDebt: {},
    proposalsById: {},
  };
  financeProjection$.set(projection);

  expect(
    transactions$({
      userId: 'user_1',
      walletId: 'wallet_1',
      limit: 25,
    }).get(),
  ).toHaveLength(25);
  expect(walletBalanceMinor$('wallet_1').get()).toBe(500_000);
});
