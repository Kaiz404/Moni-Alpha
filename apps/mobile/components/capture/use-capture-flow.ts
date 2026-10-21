import { useValue } from '@legendapp/state/react';
import { useReducer, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { approveCapture } from '@/lib/capture/approve-capture';
import {
  START,
  captureStage,
  type CaptureQuote,
  type CaptureSource,
} from '@/lib/capture/capture-stage';
import { readCapture } from '@/lib/capture/read-capture';
import { keepScannedReceipt } from '@/lib/receipts/upload-queue';
import { useMainCurrency } from '@/lib/finance/main-currency';
import {
  categoriesForUser$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import type { TransactionRowData } from '@/lib/transactions/row';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';

const HISTORY = 500;

/**
 * The stage machine for Say it and Scan a receipt, with the reader and the
 * ledger write wired in. Nothing is written until `approve`.
 */
export function useCaptureFlow(source: CaptureSource) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const currency = useMainCurrency();
  const [stage, dispatch] = useReducer(captureStage, START);
  const [approving, setApproving] = useState(false);
  const [added, setAdded] = useState<TransactionRowData | null>(null);
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const history = useValue(transactions$({ userId, limit: HISTORY }));

  const read = async (quote: CaptureQuote) => {
    dispatch({ type: 'captured', quote });
    const result =
      quote.source === 'voice' && !quote.text.trim()
        ? ({ status: 'unreadable', reason: 'Nothing was heard' } as const)
        : await readCapture(quote, {
            wallets: wallets.filter((wallet) => wallet.currency === currency),
            categories,
            history,
            defaultWalletId: getDefaultWalletId(),
          });
    dispatch({ type: 'read', result });
  };

  const approve = async () => {
    if (stage.name !== 'result' || !stage.draft.walletId) return;
    setApproving(true);
    try {
      const draft = { ...stage.draft, walletId: stage.draft.walletId };
      const transaction = await approveCapture(draft, source);
      if (transaction && stage.quote.source === 'camera')
        void keepScannedReceipt(stage.quote.imageUri, transaction.id).catch(() => {});
      const category = categories.find((item) => item.id === draft.categoryId);
      setAdded({
        kind: draft.kind,
        title: draft.merchant || category?.name || 'Transaction',
        date: draft.transactionDate,
        amountMinor: draft.amountMinor,
        currency,
        icon: resolveTransactionIcon(category?.icon, draft.kind),
        color: category?.color ?? null,
        category: category?.name ?? null,
        wallet:
          wallets.find((wallet) => wallet.id === draft.walletId)?.name ??
          'Wallet',
        autoAdded: false,
      });
      dispatch({ type: 'approved' });
    } catch (error) {
      Alert.alert(
        'Could not add this',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setApproving(false);
    }
  };

  const categoryName =
    stage.name === 'approved'
      ? (categories.find((item) => item.id === stage.draft.categoryId)
          ?.name ?? null)
      : null;

  return {
    stage,
    dispatch,
    read,
    approve,
    approving,
    added,
    categoryName,
  };
}
