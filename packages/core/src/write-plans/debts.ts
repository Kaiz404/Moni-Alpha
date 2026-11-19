import { minorToDecimal, type DebtActivityKind, type DebtDirection, type MinorAmount } from '@repo/types';

import { debtBalance, debtStatus } from '../ledger';
import type { FinanceDebt, FinanceDebtActivity } from '../read-model/types';
import {
  planned,
  refused,
  type LedgerView,
  type PlanContext,
  type Planned,
  type RowInsert,
  type StoredPatch,
  type StoredRow,
} from './types';

type CashKind = 'principal' | 'repayment';

function cashType(direction: DebtDirection, kind: CashKind): 'income' | 'expense' {
  if (direction === 'owed_to_me') return kind === 'principal' ? 'expense' : 'income';
  return kind === 'principal' ? 'income' : 'expense';
}

function cashDescription(direction: DebtDirection, kind: CashKind, counterparty: string): string {
  const outgoing = cashType(direction, kind) === 'expense';
  if (kind === 'principal') return outgoing ? `Lent to ${counterparty}` : `Borrowed from ${counterparty}`;
  return outgoing ? `Repayment to ${counterparty}` : `Repayment from ${counterparty}`;
}

/** The wallet row that mirrors an activity's cash, kept out of spending by `analysis_excluded`. */
function cashMirror(
  debt: FinanceDebt,
  activity: Pick<FinanceDebtActivity, 'id' | 'kind' | 'amountMinor' | 'activityDate' | 'note'> & {
    walletId: string;
    cashTransactionId: string;
  },
  userId: string,
): StoredRow<'transactions'> {
  const kind = activity.kind as CashKind;
  return {
    id: activity.cashTransactionId,
    user_id: userId,
    wallet_id: activity.walletId,
    amount: minorToDecimal(activity.amountMinor),
    currency: debt.currency,
    type: cashType(debt.direction, kind),
    category_id: null,
    transfer_to_wallet_id: null,
    linked_transaction_id: null,
    debt_activity_id: activity.id,
    analysis_excluded: true,
    description: cashDescription(debt.direction, kind, debt.counterpartyName),
    merchant: null,
    notes: activity.note,
    transaction_date: activity.activityDate,
    location_latitude: null,
    location_longitude: null,
    location_name: null,
    receipt_image_url: null,
    metadata: { debt_activity_id: activity.id },
    deleted: false,
  };
}

export function activitiesOfDebt(view: Pick<LedgerView, 'debtActivitiesById'>, debtId: string): FinanceDebtActivity[] {
  return Object.values(view.debtActivitiesById)
    .filter((activity) => activity.debtId === debtId)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate));
}

export type DebtActivityInput = {
  kind: DebtActivityKind;
  amountMinor: MinorAmount;
  walletId?: string;
  note?: string | null;
  activityDate?: string;
};

type ActivityWrites = { insert: RowInsert[]; activity: FinanceDebtActivity; status: FinanceDebt['status'] };

function activityWrites(
  debt: FinanceDebt,
  data: DebtActivityInput,
  activities: readonly FinanceDebtActivity[],
  view: Pick<LedgerView, 'walletsById'>,
  ctx: PlanContext,
): ActivityWrites | Exclude<Planned, { kind: 'writes' }> {
  if (!Number.isSafeInteger(data.amountMinor) || data.amountMinor <= 0) return refused('Amount must be positive');
  const balance = debtBalance(activities);
  if ((data.kind === 'repayment' || data.kind === 'write_off') && data.amountMinor > balance) {
    return refused('Amount cannot exceed the outstanding balance');
  }
  if (data.kind === 'write_off' && data.amountMinor !== balance) {
    return refused('Write-off must settle the full remaining balance');
  }
  if (data.kind !== 'write_off' && !data.walletId) return refused('Select a wallet');
  if (data.walletId) {
    const wallet = view.walletsById[data.walletId];
    if (!wallet) return refused('Wallet not found');
    if (wallet.currency !== debt.currency) return refused(`Select a ${debt.currency} wallet`);
  }
  const id = ctx.newId();
  const cashTransactionId = data.kind === 'write_off' ? null : ctx.newId();
  const activity: FinanceDebtActivity = {
    id,
    userId: ctx.userId,
    debtId: debt.id,
    kind: data.kind,
    amountMinor: data.amountMinor,
    activityDate: data.activityDate ?? ctx.now,
    walletId: data.walletId ?? null,
    cashTransactionId,
    note: data.note ?? null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  const insert: RowInsert[] = [
    {
      table: 'debt_activities',
      row: {
        id,
        user_id: ctx.userId,
        debt_id: debt.id,
        kind: activity.kind,
        amount: minorToDecimal(activity.amountMinor),
        activity_date: activity.activityDate,
        wallet_id: activity.walletId,
        cash_transaction_id: cashTransactionId,
        note: activity.note,
        deleted: false,
      },
    },
  ];
  if (cashTransactionId && data.walletId) {
    insert.push({
      table: 'transactions',
      row: cashMirror(debt, { ...activity, walletId: data.walletId, cashTransactionId }, ctx.userId),
    });
  }
  return { insert, activity, status: debtStatus([activity, ...activities]) };
}

/** Lending, borrowing, a repayment or a write-off: the activity, its cash mirror, and the debt's new status. */
export function planDebtActivity(
  debt: FinanceDebt,
  data: DebtActivityInput,
  view: Pick<LedgerView, 'walletsById' | 'debtActivitiesById'>,
  ctx: PlanContext,
): Planned<{ activity: FinanceDebtActivity }> {
  const written = activityWrites(debt, data, activitiesOfDebt(view, debt.id), view, ctx);
  if ('kind' in written) return written;
  return planned(
    {
      insert: written.insert,
      patch: [{ table: 'debts', id: debt.id, patch: { status: written.status, updated_at: ctx.now } }],
    },
    { activity: written.activity },
  );
}

export type NewDebt = {
  counterpartyName: string;
  direction: DebtDirection;
  amountMinor: MinorAmount;
  walletId: string;
  dueDate?: string | null;
  note?: string | null;
  activityDate?: string;
};

/** A new debt opens with its principal: the debt, the first activity and the cash that moved. */
export function planDebt(
  data: NewDebt,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: PlanContext,
): Planned<{ debt: FinanceDebt }> {
  const name = data.counterpartyName.trim();
  if (!name) return refused('Enter a person’s name');
  const wallet = view.walletsById[data.walletId];
  if (!wallet) return refused('Wallet not found');
  const debt: FinanceDebt = {
    id: ctx.newId(),
    userId: ctx.userId,
    counterpartyName: name,
    direction: data.direction,
    currency: wallet.currency,
    dueDate: data.dueDate ?? null,
    note: data.note ?? null,
    status: 'open',
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  const principal = { kind: 'principal' as const, ...data, note: data.note };
  const written = activityWrites(debt, principal, [], view, ctx);
  if ('kind' in written) return written;
  const row: StoredRow<'debts'> = {
    id: debt.id,
    user_id: ctx.userId,
    counterparty_name: name,
    direction: debt.direction,
    currency: debt.currency,
    due_date: debt.dueDate,
    note: debt.note,
    status: written.status,
    deleted: false,
  };
  return planned({ insert: [{ table: 'debts', row }, ...written.insert] }, { debt: { ...debt, status: written.status } });
}

/** Removing an activity removes its cash mirror and works the debt's status out again. */
export function planDebtActivityDelete(
  debt: FinanceDebt,
  activityId: string,
  view: Pick<LedgerView, 'debtActivitiesById'>,
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  const activities = activitiesOfDebt(view, debt.id);
  const activity = activities.find((item) => item.id === activityId);
  if (!activity) return refused('Debt activity not found');
  const remaining = activities.filter((item) => item.id !== activityId);
  return planned(
    {
      softDelete: [
        { table: 'debt_activities', id: activity.id, at: ctx.now },
        ...(activity.cashTransactionId
          ? [{ table: 'transactions' as const, id: activity.cashTransactionId, at: ctx.now }]
          : []),
      ],
      patch: [{ table: 'debts', id: debt.id, patch: { status: debtStatus(remaining), updated_at: ctx.now } }],
    },
    null,
  );
}

/** Changes a debt's own fields: who, when it is due, its note. Unnamed fields stay as they are. */
export function planDebtEdit(
  debt: FinanceDebt,
  edit: { counterpartyName?: string; dueDate?: string | null; note?: string | null },
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  const patch: StoredPatch<'debts'> = {};
  if (edit.counterpartyName !== undefined) {
    const name = edit.counterpartyName.trim();
    if (!name) return refused('Enter a person’s name');
    patch.counterparty_name = name;
  }
  if (edit.dueDate !== undefined) patch.due_date = edit.dueDate;
  if (edit.note !== undefined) patch.note = edit.note;
  if (!Object.keys(patch).length) return planned({}, null);
  return planned({ patch: [{ table: 'debts', id: debt.id, patch: { ...patch, updated_at: ctx.now } }] }, null);
}

/** Removes a whole debt: the debt, every activity on it and the cash each one moved, all softly. */
export function planDebtDelete(
  debt: FinanceDebt,
  view: Pick<LedgerView, 'debtActivitiesById'>,
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  const activities = activitiesOfDebt(view, debt.id);
  return planned(
    {
      softDelete: [
        ...activities.flatMap((activity) => [
          ...(activity.cashTransactionId
            ? [{ table: 'transactions' as const, id: activity.cashTransactionId, at: ctx.now }]
            : []),
          { table: 'debt_activities' as const, id: activity.id, at: ctx.now },
        ]),
        { table: 'debts', id: debt.id, at: ctx.now },
      ],
    },
    null,
  );
}

/** Works a debt's status out again, for example after a restore added activity to it. */
export function planDebtStatus(
  debtId: string,
  view: Pick<LedgerView, 'debtsById' | 'debtActivitiesById'>,
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  const debt = view.debtsById[debtId];
  const status = debtStatus(activitiesOfDebt(view, debtId));
  if (!debt || status === debt.status) return planned({}, null);
  return planned({ patch: [{ table: 'debts', id: debtId, patch: { status, updated_at: ctx.now } }] }, null);
}

/**
 * The cash mirrors an interrupted offline write never made. Idempotent: an activity whose mirror
 * the ledger holds gets nothing.
 */
export function planDebtMirrorRepair(
  view: Pick<LedgerView, 'debtsById' | 'debtActivitiesById' | 'transactionsById'>,
  ctx: Pick<PlanContext, 'userId'>,
): Planned<{ repaired: number }> {
  const insert: RowInsert[] = [];
  for (const activity of Object.values(view.debtActivitiesById)) {
    const { cashTransactionId, walletId } = activity;
    if (!cashTransactionId || !walletId || view.transactionsById[cashTransactionId]) continue;
    const debt = view.debtsById[activity.debtId];
    if (!debt || activity.kind === 'write_off') continue;
    insert.push({ table: 'transactions', row: cashMirror(debt, { ...activity, walletId, cashTransactionId }, ctx.userId) });
  }
  return planned({ insert }, { repaired: insert.length });
}
