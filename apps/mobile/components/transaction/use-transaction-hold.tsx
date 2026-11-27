import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';
import { Alert } from 'react-native';

import { HoldMenu, type HoldAction, type HoldAnchor } from '@/components/ui/hold-menu';
import { rowAmount, rowMeta, TransactionRowBody } from '@/components/ui/transaction-row';
import { useAuth } from '@/lib/auth/auth-context';
import { budgetProgress$, categoriesForUser$, transactions$, walletsForUser$ } from '@/lib/finance/selectors';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';
import { deleteTransaction, updateTransaction } from '@/lib/supabase/transactions';
import type { Screen } from '@/lib/test-ids';
import type { TransactionRowData } from '@/lib/transactions/row';
import { type FinanceTransaction, dateLabel, formatMoney, paymentBill } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

type Held = {
  transaction: FinanceTransaction;
  row: TransactionRowData;
  anchor: HoldAnchor;
  actions: readonly HoldAction[];
};

function holdable(transaction: FinanceTransaction) {
  return (
    transaction.type !== 'transfer' &&
    !transaction.debtActivityId &&
    !transaction.balanceCorrection
  );
}

export function useTransactionHold(screen: Screen): {
  holdFor: (
    transaction: FinanceTransaction,
    row: TransactionRowData,
  ) => ((anchor: HoldAnchor) => void) | undefined;
  menu: ReactElement;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const transactions = useValue(transactions$({ userId }));
  const overrides = useValue(() => (userId ? listRecurringOverrides(userId) : []));
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(budgetProgress$(userId, timezone));
  const [held, setHeld] = useState<Held | null>(null);

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  const save = (id: string, change: Parameters<typeof updateTransaction>[1]) => {
    updateTransaction(id, change).catch((error: unknown) =>
      Alert.alert('Not saved', error instanceof Error ? error.message : 'Try again.'),
    );
  };

  const editCategory = async (transaction: FinanceTransaction) => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Edit category',
      currency: transaction.currency,
      categories: toCategoryTiles(
        categories.filter(
          (category) => category.isActive && category.type === transaction.type,
        ),
        progress,
        transaction.currency,
      ),
      selectedId: transaction.categoryId,
    });
    if (picked && picked !== transaction.categoryId) save(transaction.id, { categoryId: picked });
  };

  const changeWallet = async (transaction: FinanceTransaction) => {
    const picked = await openSheet({
      kind: 'wallet',
      title: 'Change wallet',
      wallets: wallets
        .filter((wallet) => wallet.currency === transaction.currency)
        .map((wallet) => ({
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency,
          type: wallet.type,
          icon: wallet.icon,
          color: wallet.color,
          cardStyleId: wallet.cardStyleId,
        })),
      selectedId: transaction.walletId,
      emptyMessage: 'No other wallet uses this currency.',
    });
    if (picked?.walletId && picked.walletId !== transaction.walletId)
      save(transaction.id, { walletId: picked.walletId });
  };

  const remove = async (transaction: FinanceTransaction, row: TransactionRowData) => {
    const month = new Date(row.date).toLocaleDateString('en-US', { month: 'long' });
    const category = row.category;
    const confirmed = await openSheet({
      kind: 'confirm',
      title: 'Delete this transaction?',
      message: `${row.title} ${formatMoney(row.amountMinor, row.currency)} on ${dateLabel(deviceCalendar.dayKey(row.date), deviceCalendar.dayKey(new Date()))} comes out of ${month}${category ? ` and out of ${category}` : ''}.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (confirmed) void deleteTransaction(transaction.id);
  };

  const act = (action: HoldAction) => {
    if (!held) return;
    const { transaction, row } = held;
    setHeld(null);
    if (action === 'delete') void remove(transaction, row);
    else if (action === 'editCategory') void editCategory(transaction);
    else if (action === 'makeBill')
      router.push({ pathname: '/bill/new', params: { from: transaction.id } });
    else void changeWallet(transaction);
  };

  const actionsFor = (transaction: FinanceTransaction): readonly HoldAction[] => {
    const category = categories.find((each) => each.id === transaction.categoryId);
    const bill = paymentBill(
      transaction,
      transactions,
      overrides,
      new Date(),
      deviceCalendar,
      category?.name ?? null,
    );
    return bill?.kind === 'offer'
      ? ['editCategory', 'changeWallet', 'makeBill', 'delete']
      : ['editCategory', 'changeWallet', 'delete'];
  };

  return {
    holdFor: (transaction, row) =>
      holdable(transaction)
        ? (anchor) => setHeld({ transaction, row, anchor, actions: actionsFor(transaction) })
        : undefined,
    menu: (
      <HoldMenu
        screen={screen}
        anchor={held?.anchor ?? null}
        rowTitle={held?.row.title ?? ''}
        actions={held?.actions}
        liftedRow={
          held ? (
            <TransactionRowBody
              row={held.row}
              meta={rowMeta(held.row, 'category')}
              amount={rowAmount(held.row)}
            />
          ) : null
        }
        onAction={act}
        onClose={() => setHeld(null)}
      />
    ),
  };
}
