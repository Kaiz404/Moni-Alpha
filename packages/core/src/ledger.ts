/**
 * What a ledger row means. Every total, chart, report and AI metric asks these questions instead of
 * reading a row's flags itself, so a new kind of row is one edit here.
 */
import { addMinor, subtractMinor, type MinorAmount } from '@repo/types';

import { daysBetween, type DayKey } from './calendar';

/** The fields of a transaction the ledger rules read. */
export type LedgerTransaction = {
  type: 'income' | 'expense' | 'transfer';
  /** Kept out of every analysis: a balance correction, or a row the user excluded. */
  analysisExcluded: boolean;
  /** The cash side of a debt's principal or repayment. */
  debtActivityId: string | null;
};

type Flags = Pick<LedgerTransaction, 'analysisExcluded' | 'debtActivityId'>;

/** Debt cash and balance fixes move money without the user spending or earning it. */
function isOwnMoney(transaction: Flags): boolean {
  return !transaction.analysisExcluded && !transaction.debtActivityId;
}

/** The user's own spending: an expense that is neither a balance fix nor a debt repayment or loan. */
export function countsAsSpending(transaction: LedgerTransaction): boolean {
  return transaction.type === 'expense' && isOwnMoney(transaction);
}

/** Money in that counts: income that is neither a balance fix nor debt cash. */
export function countsAsIncome(transaction: LedgerTransaction): boolean {
  return transaction.type === 'income' && isOwnMoney(transaction);
}

/** Spending or income, the rows recurring bills and paydays are found in. */
export function countsAsCashFlow(transaction: LedgerTransaction): boolean {
  return countsAsSpending(transaction) || countsAsIncome(transaction);
}

/** Filed by the user: it has a category, so it says what a merchant is for. */
export function isFiled(transaction: Flags & { categoryId: string | null }): boolean {
  return !!transaction.categoryId && isOwnMoney(transaction);
}

type WalletMove = Pick<LedgerTransaction, 'type'> & {
  walletId: string;
  transferToWalletId: string | null;
  amountMinor: MinorAmount;
};

/** Whether a transaction moves money in or out of `walletId`. */
export function touchesWallet(
  transaction: Pick<WalletMove, 'walletId' | 'transferToWalletId'>,
  walletId: string,
): boolean {
  return transaction.walletId === walletId || transaction.transferToWalletId === walletId;
}

/** The signed effect of a transaction on one wallet's balance; a transfer nets out across its two ends. */
export function walletEffect(transaction: WalletMove, walletId: string): MinorAmount {
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

export type DebtActivityKind = 'principal' | 'repayment' | 'write_off';
export type LedgerDebtActivity = { kind: DebtActivityKind; amountMinor: MinorAmount };

/** What a debt has seen: lent or borrowed, paid back, written off, and what is still owed. */
export type DebtTotals = {
  principalMinor: MinorAmount;
  repaidMinor: MinorAmount;
  writtenOffMinor: MinorAmount;
  balanceMinor: MinorAmount;
};

export function debtTotals(activities: readonly LedgerDebtActivity[]): DebtTotals {
  const of = (kind: DebtActivityKind) =>
    addMinor(0, ...activities.filter((a) => a.kind === kind).map((a) => a.amountMinor));
  const principalMinor = of('principal');
  const repaidMinor = of('repayment');
  const writtenOffMinor = of('write_off');
  return {
    principalMinor,
    repaidMinor,
    writtenOffMinor,
    balanceMinor: subtractMinor(principalMinor, addMinor(repaidMinor, writtenOffMinor)),
  };
}

/** Principal less repayments and write-offs. */
export function debtBalance(activities: readonly LedgerDebtActivity[]): MinorAmount {
  return debtTotals(activities).balanceMinor;
}

/** The status a debt row stores: still owed, or closed by repayment or by a write-off. */
export type DebtStatus = 'open' | 'settled' | 'written_off';

/** Settled or written off once nothing is owed (written off when any of it was let go), else open. */
export function debtStatus(activities: readonly LedgerDebtActivity[]): DebtStatus {
  const { balanceMinor, writtenOffMinor } = debtTotals(activities);
  if (balanceMinor > 0) return 'open';
  return writtenOffMinor > 0 ? 'written_off' : 'settled';
}

/** Open debts are due soon this many days ahead of their due date. */
export const DUE_SOON_DAYS = 7;

export type DebtState = DebtStatus | 'due_soon' | 'overdue';

/** A debt's status on `today`: an open one is overdue past its due date, or due soon within a week of it. */
export function debtState(
  activities: readonly LedgerDebtActivity[],
  dueDate: DayKey | null,
  today: DayKey,
): DebtState {
  const status = debtStatus(activities);
  if (status !== 'open' || dueDate === null) return status;
  const daysLeft = daysBetween(today, dueDate);
  return daysLeft < 0 ? 'overdue' : daysLeft <= DUE_SOON_DAYS ? 'due_soon' : 'open';
}
