import { syncSystem } from '@/lib/powersync/Powersync';

export async function getWalletBalance(walletId: string): Promise<number> {
  const { db } = syncSystem;

  // Get initial balance from wallet
  const wallet = await db
    .selectFrom('wallets')
    .where('id', '=', walletId)
    .select('initial_balance')
    .executeTakeFirst();

  if (!wallet) throw new Error('Wallet not found');

  const initialBalance = parseFloat(wallet.initial_balance || '0');

  // Calculate balance from transactions
  const transactions = await db
    .selectFrom('transactions')
    .where('wallet_id', '=', walletId)
    .select(['amount', 'type'])
    .execute();

  const transactionBalance = transactions.reduce((total, tx) => {
    const amount = parseFloat(tx.amount || '0');
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