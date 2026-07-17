import type { CurrencyCode, MinorAmount, ProposedTransaction } from '@repo/types';

export type FinanceWallet = {
  id: string;
  userId: string;
  name: string;
  type: string;
  currency: CurrencyCode;
  initialBalanceMinor: MinorAmount;
  color: string | null;
  icon: string | null;
  cardStyleId: string | null;
  isActive: boolean;
  displayOrder: number;
};

export type FinanceTransaction = {
  id: string;
  userId: string;
  walletId: string;
  amountMinor: MinorAmount;
  currency: CurrencyCode;
  type: 'income' | 'expense' | 'transfer';
  analysisExcluded: boolean;
  debtActivityId: string | null;
  categoryId: string | null;
  transferToWalletId: string | null;
  linkedTransactionId: string | null;
  description: string | null;
  merchant: string | null;
  notes: string | null;
  transactionDate: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationName: string | null;
  createdAt: string;
};

export type FinanceCategory = {
  id: string;
  userId: string | null;
  name: string;
  /** Existing category metadata from the synced table; never inferred by a chart. */
  icon: string | null;
  type: 'income' | 'expense' | null;
  color: string | null;
  isActive: boolean;
  displayOrder: number;
};

export type FinanceBudget = {
  id: string;
  userId: string;
  categoryId: string;
  currency: CurrencyCode;
  amountMinor: MinorAmount;
  period: 'monthly';
};

export type FinanceDebt = {
  id: string;
  userId: string;
  counterpartyName: string;
  direction: 'owed_to_me' | 'i_owe';
  currency: CurrencyCode;
  dueDate: string | null;
  note: string | null;
  status: 'open' | 'settled' | 'written_off';
};

export type FinanceDebtActivity = {
  id: string;
  userId: string;
  debtId: string;
  kind: 'principal' | 'repayment' | 'write_off';
  amountMinor: MinorAmount;
  activityDate: string;
  walletId: string | null;
  cashTransactionId: string | null;
  note: string | null;
};

export type FinanceProposal = ProposedTransaction;

export type FinanceProjection = {
  walletsById: Record<string, FinanceWallet>;
  transactionsById: Record<string, FinanceTransaction>;
  transactionsByWallet: Record<string, string[]>;
  categoriesById: Record<string, FinanceCategory>;
  budgetsById: Record<string, FinanceBudget>;
  debtsById: Record<string, FinanceDebt>;
  debtActivitiesById: Record<string, FinanceDebtActivity>;
  debtActivityIdsByDebt: Record<string, string[]>;
  proposalsById: Record<string, FinanceProposal>;
};

export const EMPTY_FINANCE_PROJECTION: FinanceProjection = {
  walletsById: {},
  transactionsById: {},
  transactionsByWallet: {},
  categoriesById: {},
  budgetsById: {},
  debtsById: {},
  debtActivitiesById: {},
  debtActivityIdsByDebt: {},
  proposalsById: {},
};
