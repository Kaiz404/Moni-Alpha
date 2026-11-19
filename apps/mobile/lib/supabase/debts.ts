import {
  createDebtActivityInputSchema,
  createDebtInputSchema,
  decimalToMinor,
  type Debt,
  type DebtActivity,
  type DebtActivityKind,
  type DebtDirection,
  type MinorAmount,
} from '@repo/types';
import {
  debtBalance,
  planDebt,
  planDebtActivity,
  planDebtActivityDelete,
  planDebtMirrorRepair,
  planDebtStatus,
  type DebtActivityInput,
  type NewDebt,
} from '@repo/core';
import { debtActivities$, debts$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { commit, ledgerView, planContext } from '@/lib/store/writes';
import { getUserId } from '@/lib/supabase/client';

type DebtRow = {
  id: string;
  user_id: string | null;
  counterparty_name: string | null;
  direction: DebtDirection | null;
  currency: string | null;
  due_date: string | null;
  note: string | null;
  status: Debt['status'] | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};
type ActivityRow = {
  id: string;
  user_id: string | null;
  debt_id: string | null;
  kind: DebtActivityKind | null;
  amount: string | number | null;
  activity_date: string | null;
  wallet_id: string | null;
  cash_transaction_id: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

function normalizeCurrency(value: unknown): string | null {
  const currency = String(value ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function mapDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    counterpartyName: row.counterparty_name ?? '',
    direction: row.direction ?? 'owed_to_me',
    currency: normalizeCurrency(row.currency) ?? 'USD',
    dueDate: row.due_date,
    note: row.note,
    status: row.status ?? 'open',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
  };
}
function mapActivity(row: ActivityRow): DebtActivity {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    debtId: row.debt_id ?? '',
    kind: row.kind ?? 'principal',
    amountMinor: decimalToMinor(row.amount),
    activityDate: row.activity_date ?? row.created_at ?? '',
    walletId: row.wallet_id,
    cashTransactionId: row.cash_transaction_id,
    note: row.note,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
  };
}

export async function getDebts(): Promise<Debt[]> {
  const userId = await getUserId();
  if (!userId) return [];
  return getRecordValues<DebtRow>(debts$)
    .filter((row) => row.user_id === userId)
    .map(mapDebt);
}

export async function getDebtById(id: string): Promise<Debt | null> {
  return (await getDebts()).find((debt) => debt.id === id) ?? null;
}

export async function getDebtActivities(debtId?: string): Promise<DebtActivity[]> {
  const userId = await getUserId();
  if (!userId) return [];
  return activitiesOf(userId, debtId);
}

function activitiesOf(userId: string, debtId?: string): DebtActivity[] {
  return getRecordValues<ActivityRow>(debtActivities$)
    .filter((row) => row.user_id === userId && (!debtId || row.debt_id === debtId))
    .map(mapActivity)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate));
}

async function addActivity(debt: Debt, data: DebtActivityInput): Promise<DebtActivity> {
  const ctx = await planContext();
  const { activity } = commit(planDebtActivity(debt, data, ledgerView(), ctx));
  return { ...activity, createdAt: ctx.now, updatedAt: ctx.now };
}

/** Works a debt's status out again after a restore added activity to it. */
export function refreshDebtStatus(debtId: string): void {
  commit(planDebtStatus(debtId, ledgerView(), { now: new Date().toISOString() }));
}

export async function createDebt(data: NewDebt): Promise<Debt> {
  const parsed = createDebtInputSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid debt');
  const ctx = await planContext().catch(() => {
    throw new Error('Not authenticated');
  });
  const { debt } = commit(planDebt(parsed.data, ledgerView(), ctx));
  return { ...debt, createdAt: ctx.now, updatedAt: ctx.now };
}

/** In-place edits on the debt page. Money never changes here; it moves through activities. */
export function updateDebt(
  id: string,
  patch: {
    counterpartyName?: string;
    note?: string | null;
    dueDate?: string | null;
  },
): void {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.counterpartyName !== undefined) {
    const name = patch.counterpartyName.trim();
    if (!name) throw new Error('Enter a name');
    row.counterparty_name = name.slice(0, 120);
  }
  if (patch.note !== undefined) row.note = patch.note?.trim() || null;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  patchRow(debts$, id, row);
}

export async function addDebtPrincipal(
  debt: Debt,
  amountMinor: MinorAmount,
  walletId: string,
  note?: string | null,
) {
  const parsed = createDebtActivityInputSchema.safeParse({
    kind: 'principal',
    amountMinor,
    walletId,
    note,
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid debt activity');
  return addActivity(debt, parsed.data);
}
export async function repayDebt(
  debt: Debt,
  amountMinor: MinorAmount,
  walletId: string,
  note?: string | null,
) {
  const parsed = createDebtActivityInputSchema.safeParse({
    kind: 'repayment',
    amountMinor,
    walletId,
    note,
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid debt activity');
  return addActivity(debt, parsed.data);
}
export async function writeOffDebt(debt: Debt, note?: string | null) {
  const activities = await getDebtActivities(debt.id);
  return addActivity(debt, {
    kind: 'write_off',
    amountMinor: debtBalance(activities),
    note,
  });
}

export function deleteDebtActivity(debt: Debt, activityId: string): void {
  commit(planDebtActivityDelete(debt, activityId, ledgerView(), { now: new Date().toISOString() }));
}

/** Idempotently reconstruct a missing local cash mirror after an interrupted offline write. */
export async function reconcileDebtTransactions(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;
  return commit(planDebtMirrorRepair(ledgerView(), { userId })).repaired;
}
