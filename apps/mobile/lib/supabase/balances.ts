import { transactions$, wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';

export async function getWalletBalance(walletId: string): Promise<number> {
  const wallet = getRecordValues<{
    id: string;
    initial_balance: string | number | null;
  }>(wallets$).find((w) => w.id === walletId);

  if (!wallet) throw new Error('Wallet not found');

  const initialBalance = parseFloat(String(wallet.initial_balance ?? '0'));

  const txs = getRecordValues<{
    wallet_id: string | null;
    amount: string | number | null;
    type: string | null;
  }>(transactions$).filter((t) => t.wallet_id === walletId);

  const transactionBalance = txs.reduce((total, tx) => {
    const amount = parseFloat(String(tx.amount ?? '0'));
    return tx.type === 'income' ? total + amount : total - amount;
  }, 0);

  return initialBalance + transactionBalance;
}

export async function getWalletBalances(walletIds: string[]): Promise<Record<string, number>> {
  const balances: Record<string, number> = {};

  for (const walletId of walletIds) {
    balances[walletId] = await getWalletBalance(walletId);
  }

  return balances;
}
