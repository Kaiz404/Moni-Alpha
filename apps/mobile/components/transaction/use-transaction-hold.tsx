import { useValue } from '@legendapp/state/react';
import { useEffect, useState, type ReactElement } from 'react';
import { Alert } from 'react-native';

import { HoldMenu, type HoldAction, type HoldAnchor } from '@/components/ui/hold-menu';
import { rowAmount, rowMeta, TransactionRowBody } from '@/components/ui/transaction-row';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/dates/day-label';
import { formatMoney } from '@/lib/finance/format-money';
import {
  budgetProgress$,
  categoriesForUser$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { deleteTransaction, updateTransaction } from '@/lib/supabase/transactions';
import type { Screen } from '@/lib/test-ids';
import type { TransactionRowData } from '@/lib/transactions/row';

type Held = {
  transaction: FinanceTransaction;
  row: TransactionRowData;
  anchor: HoldAnchor;
};

/** Transfers, debt cash and balance corrections open their own pages instead. */
function holdable(transaction: FinanceTransaction) {
  return (
    transaction.type !== 'transfer' &&
    !transaction.debtActivityId &&
    !transaction.balanceCorrection
  );
}

/**
 * Press and hold on a transaction row: Edit category, Change wallet, Delete. `holdFor` gives a
 * row its `onHold`, and `menu` renders the one menu for the screen.
 */
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
    const category = 'category' in row ? row.category : null;
    const confirmed = await openSheet({
      kind: 'confirm',
      title: 'Delete this transaction?',
      message: `${row.title} ${formatMoney(row.amountMinor, row.currency)} on ${formatDate(row.date)} comes out of ${month}${category ? ` and out of ${category}` : ''}.`,
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
    else void changeWallet(transaction);
  };

  return {
    holdFor: (transaction, row) =>
      holdable(transaction) ? (anchor) => setHeld({ transaction, row, anchor }) : undefined,
    menu: (
      <HoldMenu
        screen={screen}
        anchor={held?.anchor ?? null}
        rowTitle={held?.row.title ?? ''}
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
