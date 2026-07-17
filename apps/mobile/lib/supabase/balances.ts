import { transactions$, wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { decimalToMinor, addMinor, type MinorAmount } from '@repo/types';
import { isTransactionRelevantToWallet, transactionDeltaMinor } from '@/lib/finance/ledger';

type TransactionBalanceRow = {
  wallet_id?: string | null;
  transfer_to_wallet_id?: string | null;
  amount?: string | number | null;
  type?: 'income' | 'expense' | 'transfer' | null;
};

function toLedgerTransaction(row: TransactionBalanceRow) {
  return {
    walletId: row.wallet_id ?? '',
    transferToWalletId: row.transfer_to_wallet_id ?? null,
    amountMinor: decimalToMinor(row.amount),
    type: row.type ?? 'expense',
  } as const;
}

export async function getWalletBalance(walletId: string): Promise<MinorAmount> {
  const wallet = getRecordValues<{
    id: string;
    initial_balance: string | number | null;
  }>(wallets$).find((w) => w.id === walletId);

  if (!wallet) throw new Error('Wallet not found');

  const initialBalance = decimalToMinor(wallet.initial_balance);

  const txs = getRecordValues<TransactionBalanceRow>(transactions$)
    .map(toLedgerTransaction)
    .filter((transaction) => isTransactionRelevantToWallet(transaction, walletId));

  return addMinor(
    initialBalance,
    ...txs.map((transaction) => transactionDeltaMinor(transaction, walletId)),
  );
}

export async function getWalletBalances(walletIds: string[]): Promise<Record<string, MinorAmount>> {
  if (walletIds.length === 0) return {};

  const walletIdSet = new Set(walletIds);
  const initials: Record<string, MinorAmount> = {};
  const walletRows = getRecordValues<{
    id: string;
    initial_balance: string | number | null;
  }>(wallets$);

  for (const walletId of walletIds) {
    const wallet = walletRows.find((w) => w.id === walletId);
    initials[walletId] = wallet ? decimalToMinor(wallet.initial_balance) : (0 as MinorAmount);
  }

  const balances = { ...initials };
  const txs = getRecordValues<TransactionBalanceRow>(transactions$).map(toLedgerTransaction);

  for (const tx of txs) {
    const walletId = tx.walletId;
    if (walletId && walletIdSet.has(walletId)) {
      balances[walletId] = addMinor(balances[walletId] ?? 0, transactionDeltaMinor(tx, walletId));
    }
    const transferTo = tx.transferToWalletId;
    if (transferTo && walletIdSet.has(transferTo)) {
      balances[transferTo] = addMinor(
        balances[transferTo] ?? 0,
        transactionDeltaMinor(tx, transferTo),
      );
    }
  }

  return balances;
}
