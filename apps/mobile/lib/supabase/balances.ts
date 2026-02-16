import { supabase } from '@/lib/supabase/client';

export async function getWalletBalance(walletId: string): Promise<number> {
  // Get initial balance from wallet
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('initial_balance')
    .eq('id', walletId)
    .single();

  if (walletError) throw walletError;

  const initialBalance = parseFloat(wallet.initial_balance);

  // Calculate balance from transactions
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('wallet_id', walletId);

  if (txError) throw txError;

  const transactionBalance = (transactions || []).reduce((total, tx) => {
    const amount = parseFloat(tx.amount);
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