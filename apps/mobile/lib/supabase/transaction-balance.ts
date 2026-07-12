/** Balance delta for a single transaction row relative to one wallet. Mirrors wallet_balances view. */
export type TransactionBalanceRow = {
  wallet_id?: string | null;
  transfer_to_wallet_id?: string | null;
  amount?: string | number | null;
  type?: string | null;
};

export function parseTxAmount(amount: string | number | null | undefined): number {
  return parseFloat(String(amount ?? '0'));
}

export function isTransactionRelevantToWallet(
  tx: TransactionBalanceRow,
  walletId: string,
): boolean {
  return tx.wallet_id === walletId || tx.transfer_to_wallet_id === walletId;
}

/** Signed amount change for walletId from this transaction row. */
export function transactionDelta(tx: TransactionBalanceRow, walletId: string): number {
  const amount = parseTxAmount(tx.amount);
  const type = tx.type;

  if (type === 'income' && tx.wallet_id === walletId) return amount;
  if (type === 'expense' && tx.wallet_id === walletId) return -amount;
  if (type === 'transfer') {
    if (tx.wallet_id === walletId) return -amount;
    if (tx.transfer_to_wallet_id === walletId) return amount;
  }
  return 0;
}

/** Net-worth delta across all wallets (transfers net to zero). */
export function transactionNetWorthDelta(tx: TransactionBalanceRow): number {
  const amount = parseTxAmount(tx.amount);
  const type = tx.type;

  if (type === 'income') return amount;
  if (type === 'expense') return -amount;
  return 0;
}

/** Counterparty wallet when viewing a transfer from walletId's perspective. */
export function getTransferCounterpartyWalletId(
  tx: TransactionBalanceRow & { wallet_id?: string | null; transfer_to_wallet_id?: string | null },
  viewingWalletId: string,
): string | null {
  if (tx.type !== 'transfer') return null;
  if (tx.wallet_id === viewingWalletId) return tx.transfer_to_wallet_id ?? null;
  if (tx.transfer_to_wallet_id === viewingWalletId) return tx.wallet_id ?? null;
  return null;
}

/** Human-readable transfer label, e.g. "Maybank → Savings". */
export function formatTransferLabel(
  tx: TransactionBalanceRow,
  walletNames: Record<string, string>,
  viewingWalletId?: string,
): string {
  const fromName = walletNames[tx.wallet_id ?? ''] ?? 'Wallet';
  const toName = walletNames[tx.transfer_to_wallet_id ?? ''] ?? 'Wallet';

  if (viewingWalletId && tx.wallet_id === viewingWalletId) {
    return `→ ${toName}`;
  }
  if (viewingWalletId && tx.transfer_to_wallet_id === viewingWalletId) {
    return `← ${fromName}`;
  }
  return `${fromName} → ${toName}`;
}
