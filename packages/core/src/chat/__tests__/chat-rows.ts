import type { CurrencyCode, MinorAmount } from '@repo/types';

import type {
  FinanceBudget,
  FinanceCategory,
  FinanceProposal,
  FinanceTransaction,
  FinanceWallet,
} from '../../read-model/types';

export const MYR = 'MYR' as CurrencyCode;
export const SGD = 'SGD' as CurrencyCode;
const STAMP = '2026-09-01T00:00:00.000Z';
const sen = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;
const pad = (value: number) => String(value).padStart(2, '0');

/** Noon in Kuala Lumpur on a day of 2026. */
export const noon = (month: number, day: number) =>
  new Date(`2026-${pad(month)}-${pad(day)}T12:00:00+08:00`).toISOString();

let nextId = 1;

export function spend(
  userId: string,
  [month, day]: [number, number],
  ringgit: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id: `t${nextId++}`,
    userId,
    walletId: 'maybank',
    amountMinor: sen(ringgit),
    currency: MYR,
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: null,
    notes: null,
    transactionDate: noon(month, day),
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    placeId: null,
    placeCoordsAt: null,
    autoAdded: false,
    balanceCorrection: false,
    receiptImageUrl: null,
    metadata: {},
    createdAt: noon(month, day),
    updatedAt: noon(month, day),
    ...over,
  };
}

export function category(id: string, name: string, userId: string | null): FinanceCategory {
  return {
    id,
    userId,
    name,
    icon: null,
    type: 'expense',
    color: null,
    isActive: true,
    displayOrder: 0,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

export function budget(userId: string, categoryId: string, ringgit: number): FinanceBudget {
  return {
    id: `b-${userId}-${categoryId}`,
    userId,
    categoryId,
    currency: MYR,
    amountMinor: sen(ringgit),
    period: 'monthly',
  };
}

export function wallet(
  id: string,
  userId: string,
  currency: CurrencyCode,
  ringgit: number,
): FinanceWallet {
  return {
    id,
    userId,
    name: id,
    type: 'bank',
    currency,
    initialBalanceMinor: sen(ringgit),
    color: null,
    icon: null,
    cardStyleId: null,
    isActive: true,
    displayOrder: 0,
    balanceConfirmedAt: STAMP,
    notificationPackage: null,
    notificationAppLabel: null,
    notificationAccountHint: null,
    updatedAt: STAMP,
  };
}

/** A capture with only the fields the chat snapshot reads. */
export function proposal(
  id: string,
  userId: string,
  ringgit: number,
  over: Partial<FinanceProposal>,
): FinanceProposal {
  return {
    id,
    userId,
    type: 'expense',
    amountMinor: sen(ringgit),
    walletId: null,
    sourceType: 'text',
    currency: 'USD',
    ...over,
  } as FinanceProposal;
}

export const byId = <T extends { id: string }>(rows: T[]): Record<string, T> =>
  Object.fromEntries(rows.map((row) => [row.id, row]));
