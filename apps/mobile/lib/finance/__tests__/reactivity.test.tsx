import { observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { decimalToMinor } from '@repo/types';
import { financeProjection$ } from '../projection';
import { walletBalanceMinor$, walletById$ } from '../selectors';
import type { FinanceProjection } from '../types';

it('does not rerender an unrelated fine-grained subscription', () => {
  const walletBalance$ = observable(100);
  const unrelatedTransaction$ = observable(1);
  let renders = 0;
  function WalletBalance() {
    renders += 1;
    return <Text>{useValue(walletBalance$)}</Text>;
  }
  render(<WalletBalance />);
  expect(screen.getByText('100')).toBeTruthy();
  unrelatedTransaction$.set(2);
  expect(renders).toBe(1);
});

it('renders a keyed wallet projection selector without observing an unrelated transaction', () => {
  const projection: FinanceProjection = {
    walletsById: {
      wallet_1: {
        id: 'wallet_1',
        userId: 'user_1',
        name: 'Cash',
        type: 'cash',
        currency: 'USD',
        initialBalanceMinor: decimalToMinor('10'),
        color: null,
        icon: null,
        cardStyleId: null,
        isActive: true,
        displayOrder: 0,
      },
    },
    transactionsById: {
      transaction_1: {
        id: 'transaction_1',
        userId: 'user_1',
        walletId: 'wallet_1',
        amountMinor: decimalToMinor('2'),
        currency: 'USD',
        type: 'income',
        analysisExcluded: false,
        debtActivityId: null,
        categoryId: null,
        transferToWalletId: null,
        linkedTransactionId: null,
        description: null,
        merchant: null,
        notes: null,
        transactionDate: '2026-01-01T00:00:00.000Z',
        locationLatitude: null,
        locationLongitude: null,
        locationName: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      transaction_other: {
        id: 'transaction_other',
        userId: 'user_1',
        walletId: 'wallet_other',
        amountMinor: decimalToMinor('5'),
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
        transactionDate: '2026-01-01T00:00:00.000Z',
        locationLatitude: null,
        locationLongitude: null,
        locationName: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
    transactionsByWallet: {
      wallet_1: ['transaction_1'],
      wallet_other: ['transaction_other'],
    },
    categoriesById: {},
    budgetsById: {},
    debtsById: {},
    debtActivitiesById: {},
    debtActivityIdsByDebt: {},
    proposalsById: {},
  };
  financeProjection$.set(projection);
  let renders = 0;
  function WalletCard() {
    renders += 1;
    const wallet = useValue(walletById$('wallet_1'));
    const balance = useValue(walletBalanceMinor$('wallet_1'));
    return (
      <Text>
        {wallet?.name}: {balance}
      </Text>
    );
  }
  render(<WalletCard />);
  expect(screen.getByText('Cash: 1200')).toBeTruthy();
  act(() => {
    financeProjection$.transactionsById.transaction_other.amountMinor.set(
      decimalToMinor('6'),
    );
  });
  expect(renders).toBe(1);
});
