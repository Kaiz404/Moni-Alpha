import { addMinor, type MinorAmount, subtractMinor } from '@repo/types';
import type { FinanceDebtActivity, FinanceTransaction } from './types';

/** The signed effect of a transaction on one wallet; transfers correctly net at both ends. */
export function transactionDeltaMinor(
  transaction: Pick<FinanceTransaction, 'walletId' | 'transferToWalletId' | 'amountMinor' | 'type'>,
  walletId: string,
): MinorAmount {
  if (transaction.type === 'income' && transaction.walletId === walletId)
    return transaction.amountMinor;
  if (transaction.type === 'expense' && transaction.walletId === walletId)
    return subtractMinor(0, transaction.amountMinor);
  if (transaction.type === 'transfer') {
    if (transaction.walletId === walletId) return subtractMinor(0, transaction.amountMinor);
    if (transaction.transferToWalletId === walletId) return transaction.amountMinor;
  }
  return 0 as MinorAmount;
}

export function isTransactionRelevantToWallet(
  transaction: Pick<FinanceTransaction, 'walletId' | 'transferToWalletId'>,
  walletId: string,
): boolean {
  return transaction.walletId === walletId || transaction.transferToWalletId === walletId;
}

export function outstandingDebtBalanceMinor(
  activities: Array<Pick<FinanceDebtActivity, 'kind' | 'amountMinor'>>,
): MinorAmount {
  return addMinor(
    ...activities.map((activity) =>
      activity.kind === 'principal' ? activity.amountMinor : subtractMinor(0, activity.amountMinor),
    ),
  );
}
