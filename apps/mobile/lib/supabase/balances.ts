import { transactions$, wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import {
  isTransactionRelevantToWallet,
  parseTxAmount,
  transactionDelta,
  type TransactionBalanceRow,
} from '@/lib/supabase/transaction-balance';

export async function getWalletBalance(walletId: string): Promise<number> {
  const wallet = getRecordValues<{
    id: string;
    initial_balance: string | number | null;
  }>(wallets$).find((w) => w.id === walletId);

  if (!wallet) throw new Error('Wallet not found');

  const initialBalance = parseTxAmount(wallet.initial_balance);

  const txs = getRecordValues<TransactionBalanceRow>(transactions$).filter((t) =>
    isTransactionRelevantToWallet(t, walletId),
  );

  const transactionBalance = txs.reduce(
    (total, tx) => total + transactionDelta(tx, walletId),
    0,
  );

  return initialBalance + transactionBalance;
}

export async function getWalletBalances(walletIds: string[]): Promise<Record<string, number>> {
  if (walletIds.length === 0) return {};

  const walletIdSet = new Set(walletIds);
  const initials: Record<string, number> = {};
  const walletRows = getRecordValues<{
    id: string;
    initial_balance: string | number | null;
  }>(wallets$);

  for (const walletId of walletIds) {
    const wallet = walletRows.find((w) => w.id === walletId);
    initials[walletId] = wallet ? parseTxAmount(wallet.initial_balance) : 0;
  }

  const balances = { ...initials };
  const txs = getRecordValues<TransactionBalanceRow>(transactions$);

  for (const tx of txs) {
    const walletId = tx.wallet_id;
    if (walletId && walletIdSet.has(walletId)) {
      balances[walletId] = (balances[walletId] ?? 0) + transactionDelta(tx, walletId);
    }
    const transferTo = tx.transfer_to_wallet_id;
    if (transferTo && walletIdSet.has(transferTo)) {
      balances[transferTo] = (balances[transferTo] ?? 0) + transactionDelta(tx, transferTo);
    }
  }

  return balances;
}
