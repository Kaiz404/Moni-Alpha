import { decimalToMinor } from '@repo/types';
import { normalizeCurrency } from './money';
import type {
  FinanceBudget,
  FinanceCategory,
  FinanceDebt,
  FinanceDebtActivity,
  FinanceProposal,
  FinanceTransaction,
  FinanceWallet,
} from './types';

type RawRow = Record<string, unknown> & { id?: unknown; deleted?: unknown };

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function nullableString(value: unknown): string | null {
  const text = stringValue(value).trim();
  return text || null;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function amountMinor(value: unknown) {
  try {
    return decimalToMinor(value as string | number | null | undefined);
  } catch {
    return null;
  }
}

function active(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function isoDate(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  return fallback;
}

export function isLiveRow(row: RawRow | null | undefined): row is RawRow & { id: string } {
  return Boolean(row && !row.deleted && typeof row.id === 'string' && row.id);
}

export function toFinanceWallet(row: RawRow): FinanceWallet | null {
  if (!isLiveRow(row)) return null;
  const initialBalanceMinor = amountMinor(row.initial_balance);
  if (initialBalanceMinor === null) return null;
  return {
    id: row.id,
    userId: stringValue(row.user_id),
    name: stringValue(row.name),
    type: stringValue(row.type),
    currency: normalizeCurrency(row.currency),
    initialBalanceMinor,
    color: nullableString(row.color),
    icon: nullableString(row.icon),
    cardStyleId: nullableString(row.card_style_id),
    isActive: active(row.is_active),
    displayOrder: Number(row.display_order ?? 0) || 0,
  };
}

export function toFinanceTransaction(row: RawRow): FinanceTransaction | null {
  if (!isLiveRow(row)) return null;
  const type = row.type;
  if (type !== 'income' && type !== 'expense' && type !== 'transfer') return null;
  const transactionDate = isoDate(row.transaction_date, isoDate(row.created_at));
  const parsedAmount = amountMinor(row.amount);
  if (!transactionDate || parsedAmount === null) return null;
  return {
    id: row.id,
    userId: stringValue(row.user_id),
    walletId: stringValue(row.wallet_id),
    amountMinor: parsedAmount,
    currency: normalizeCurrency(row.currency),
    type,
    analysisExcluded: active(row.analysis_excluded),
    debtActivityId: nullableString(row.debt_activity_id),
    categoryId: nullableString(row.category_id),
    transferToWalletId: nullableString(row.transfer_to_wallet_id),
    linkedTransactionId: nullableString(row.linked_transaction_id),
    description: nullableString(row.description),
    merchant: nullableString(row.merchant),
    notes: nullableString(row.notes),
    transactionDate,
    locationLatitude: numberValue(row.location_latitude),
    locationLongitude: numberValue(row.location_longitude),
    locationName: nullableString(row.location_name),
    createdAt: isoDate(row.created_at, transactionDate),
  };
}

export function toFinanceCategory(row: RawRow): FinanceCategory | null {
  if (!isLiveRow(row)) return null;
  const type = row.type === 'income' || row.type === 'expense' ? row.type : null;
  return {
    id: row.id,
    userId: nullableString(row.user_id),
    name: stringValue(row.name) || 'Uncategorized',
    type,
    color: nullableString(row.color),
    isActive: active(row.is_active),
    displayOrder: Number(row.display_order ?? 0) || 0,
  };
}

export function toFinanceBudget(row: RawRow): FinanceBudget | null {
  if (!isLiveRow(row)) return null;
  const categoryId = stringValue(row.category_id);
  const parsedAmount = amountMinor(row.amount);
  if (!categoryId || parsedAmount === null) return null;
  return {
    id: row.id,
    userId: stringValue(row.user_id),
    categoryId,
    currency: normalizeCurrency(row.currency),
    amountMinor: parsedAmount,
    period: 'monthly',
  };
}

export function toFinanceDebt(row: RawRow): FinanceDebt | null {
  if (!isLiveRow(row)) return null;
  const direction = row.direction;
  if (direction !== 'owed_to_me' && direction !== 'i_owe') return null;
  const status = row.status === 'settled' || row.status === 'written_off' ? row.status : 'open';
  return {
    id: row.id,
    userId: stringValue(row.user_id),
    counterpartyName: stringValue(row.counterparty_name),
    direction,
    currency: normalizeCurrency(row.currency),
    dueDate: nullableString(row.due_date),
    note: nullableString(row.note),
    status,
  };
}

export function toFinanceDebtActivity(row: RawRow): FinanceDebtActivity | null {
  if (!isLiveRow(row)) return null;
  const kind = row.kind;
  if (kind !== 'principal' && kind !== 'repayment' && kind !== 'write_off') return null;
  const debtId = stringValue(row.debt_id);
  const parsedAmount = amountMinor(row.amount);
  if (!debtId || parsedAmount === null) return null;
  return {
    id: row.id,
    userId: stringValue(row.user_id),
    debtId,
    kind,
    amountMinor: parsedAmount,
    activityDate: isoDate(row.activity_date, isoDate(row.created_at)),
    walletId: nullableString(row.wallet_id),
    cashTransactionId: nullableString(row.cash_transaction_id),
    note: nullableString(row.note),
  };
}

export function toFinanceProposal(row: RawRow): FinanceProposal | null {
  if (!isLiveRow(row)) return null;
  const type = row.type === 'income' || row.type === 'expense' || row.type === 'transfer' ? row.type : null;
  const parsedAmount = row.amount == null ? null : amountMinor(row.amount);
  if (row.amount != null && parsedAmount === null) return null;
  return {
    id: row.id,
    userId: stringValue(row.user_id),
    sourceType: row.source_type === 'text' || row.source_type === 'image' ? row.source_type : 'notification',
    sourceApp: nullableString(row.source_app),
    sourceText: nullableString(row.source_text),
    sourceImageUri: nullableString(row.source_image_uri),
    notificationTitle: nullableString(row.notification_title),
    notificationBody: nullableString(row.notification_body),
    notificationReceivedAt: nullableString(row.notification_received_at),
    aiReasoning: nullableString(row.ai_reasoning),
    aiConfidence: numberValue(row.ai_confidence),
    walletId: nullableString(row.wallet_id),
    walletHint: nullableString(row.wallet_hint),
    transferToWalletId: nullableString(row.transfer_to_wallet_id),
    transferToWalletHint: nullableString(row.transfer_to_wallet_hint),
    amountMinor: parsedAmount,
    currency: normalizeCurrency(row.currency),
    type,
    description: nullableString(row.description),
    merchant: nullableString(row.merchant),
    categoryId: nullableString(row.category_id),
    categoryHint: nullableString(row.category_hint),
    transactionDate: nullableString(row.transaction_date),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at, isoDate(row.created_at)),
    status: 'pending',
  };
}
