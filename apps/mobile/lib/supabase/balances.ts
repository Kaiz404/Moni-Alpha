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
  const balances: Record<string, number> = {};

  for (const walletId of walletIds) {
    balances[walletId] = await getWalletBalance(walletId);
  }

  return balances;
}
