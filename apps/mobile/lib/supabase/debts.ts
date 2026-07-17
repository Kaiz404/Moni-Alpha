import { randomUUID } from "expo-crypto";
import {
  createDebtActivityInputSchema,
  createDebtInputSchema,
  type Debt,
  type DebtActivity,
  type DebtActivityKind,
  type DebtDirection,
} from "@repo/types";
import { debtActivities$, debts$, transactions$, wallets$ } from "@/lib/store";
import { getRecordValues, patchRow } from "@/lib/store/helpers";
import { getUserId } from "@/lib/supabase/client";

type DebtRow = {
  id: string;
  user_id: string | null;
  counterparty_name: string | null;
  direction: DebtDirection | null;
  currency: string | null;
  due_date: string | null;
  note: string | null;
  status: Debt["status"] | null;
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

const amountOf = (value: string | number | null | undefined) =>
  Number.parseFloat(String(value ?? 0)) || 0;

function normalizeCurrency(value: unknown): string | null {
  const currency = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function mapDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    userId: row.user_id ?? "",
    counterpartyName: row.counterparty_name ?? "",
    direction: row.direction ?? "owed_to_me",
    currency: normalizeCurrency(row.currency) ?? "USD",
    dueDate: row.due_date,
    note: row.note,
    status: row.status ?? "open",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? row.created_at ?? "",
  };
}
function mapActivity(row: ActivityRow): DebtActivity {
  return {
    id: row.id,
    userId: row.user_id ?? "",
    debtId: row.debt_id ?? "",
    kind: row.kind ?? "principal",
    amount: amountOf(row.amount),
    activityDate: row.activity_date ?? row.created_at ?? "",
    walletId: row.wallet_id,
    cashTransactionId: row.cash_transaction_id,
    note: row.note,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? row.created_at ?? "",
  };
}

export function outstandingDebtBalance(
  activities: Array<Pick<DebtActivity, "kind" | "amount">>,
): number {
  return (
    Math.round(
      activities.reduce(
        (sum, activity) =>
          sum +
          (activity.kind === "principal" ? activity.amount : -activity.amount),
        0,
      ) * 100,
    ) / 100
  );
}

export function debtDueState(
  debt: Debt,
  balance: number,
  today = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
): "open" | "due_soon" | "overdue" | "settled" | "written_off" {
  if (debt.status === "written_off") return "written_off";
  if (balance <= 0) return "settled";
  if (!debt.dueDate) return "open";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);
  const current = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const todayKey = `${current.year}-${current.month}-${current.day}`;
  const days = Math.round(
    (Date.parse(`${debt.dueDate}T00:00:00Z`) -
      Date.parse(`${todayKey}T00:00:00Z`)) /
      86400000,
  );
  if (days < 0) return "overdue";
  if (days <= 7) return "due_soon";
  return "open";
}

export async function getDebts(): Promise<Debt[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const activities = getRecordValues<ActivityRow>(debtActivities$);
  const walletCurrencyById = new Map(
    getRecordValues<{ id: string; currency: string | null }>(wallets$).map(
      (wallet) => [wallet.id, normalizeCurrency(wallet.currency)],
    ),
  );

  return getRecordValues<DebtRow>(debts$)
    .filter((row) => row.user_id === userId)
    .map((row) => {
      const validCurrency = normalizeCurrency(row.currency);
      if (validCurrency) return mapDebt(row);

      // Older/offline rows can arrive malformed. Every cash debt starts with a
      // linked wallet activity, which is the authoritative source for recovery.
      const recovered = activities
        .filter((activity) => activity.debt_id === row.id && activity.wallet_id)
        .map((activity) => walletCurrencyById.get(activity.wallet_id ?? ""))
        .find((currency): currency is string => Boolean(currency));
      if (recovered) {
        patchRow(debts$, row.id, {
          currency: recovered,
          updated_at: new Date().toISOString(),
        });
        return mapDebt({ ...row, currency: recovered });
      }
      return mapDebt(row);
    });
}

export async function getDebtById(id: string): Promise<Debt | null> {
  return (await getDebts()).find((debt) => debt.id === id) ?? null;
}

export async function getDebtActivities(
  debtId?: string,
): Promise<DebtActivity[]> {
  const userId = await getUserId();
  if (!userId) return [];
  return getRecordValues<ActivityRow>(debtActivities$)
    .filter(
      (row) => row.user_id === userId && (!debtId || row.debt_id === debtId),
    )
    .map(mapActivity)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate));
}

function walletCurrency(walletId: string): string {
  const wallet = getRecordValues<{ id: string; currency: string | null }>(
    wallets$,
  ).find((item) => item.id === walletId);
  if (!wallet) throw new Error("Wallet not found");
  const currency = normalizeCurrency(wallet.currency);
  if (!currency) throw new Error("Wallet has an invalid currency code");
  return currency;
}

function cashType(
  direction: DebtDirection,
  kind: "principal" | "repayment",
): "income" | "expense" {
  return direction === "owed_to_me"
    ? kind === "principal"
      ? "expense"
      : "income"
    : kind === "principal"
      ? "income"
      : "expense";
}

function cashDescription(
  direction: DebtDirection,
  kind: "principal" | "repayment",
  counterparty: string,
): string {
  const outgoing = cashType(direction, kind) === "expense";
  if (kind === "principal")
    return outgoing
      ? `Lent to ${counterparty}`
      : `Borrowed from ${counterparty}`;
  return outgoing
    ? `Repayment to ${counterparty}`
    : `Repayment from ${counterparty}`;
}

async function setDebtStatus(
  debt: Debt,
  nextActivities: DebtActivity[],
): Promise<void> {
  const balance = outstandingDebtBalance(nextActivities);
  const latest = nextActivities.find(
    (activity) => activity.kind === "write_off",
  );
  const status: Debt["status"] =
    balance <= 0 ? (latest ? "written_off" : "settled") : "open";
  patchRow(debts$, debt.id, { status, updated_at: new Date().toISOString() });
}

async function addActivity(
  debt: Debt,
  data: {
    kind: DebtActivityKind;
    amount: number;
    walletId?: string;
    note?: string | null;
    activityDate?: string;
  },
): Promise<DebtActivity> {
  if (!Number.isFinite(data.amount) || data.amount <= 0)
    throw new Error("Amount must be positive");
  const activities = await getDebtActivities(debt.id);
  const currentBalance = outstandingDebtBalance(activities);
  if (
    (data.kind === "repayment" || data.kind === "write_off") &&
    data.amount > currentBalance
  )
    throw new Error("Amount cannot exceed the outstanding balance");
  if (data.kind === "write_off" && data.amount !== currentBalance)
    throw new Error("Write-off must settle the full remaining balance");
  if (data.kind !== "write_off" && !data.walletId)
    throw new Error("Select a wallet");
  if (data.walletId && walletCurrency(data.walletId) !== debt.currency)
    throw new Error(`Select a ${debt.currency} wallet`);
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const now = new Date().toISOString();
  const id = randomUUID();
  const cashTransactionId = data.kind === "write_off" ? null : randomUUID();
  const activityDate = data.activityDate ?? now;
  debtActivities$[id].set({
    id,
    user_id: userId,
    debt_id: debt.id,
    kind: data.kind,
    amount: data.amount,
    activity_date: activityDate,
    wallet_id: data.walletId ?? null,
    cash_transaction_id: cashTransactionId,
    note: data.note ?? null,
    deleted: false,
  });
  if (cashTransactionId && data.walletId) {
    const cashKind = data.kind as "principal" | "repayment";
    transactions$[cashTransactionId].set({
      id: cashTransactionId,
      user_id: userId,
      wallet_id: data.walletId,
      amount: data.amount,
      currency: debt.currency,
      type: cashType(debt.direction, cashKind),
      category_id: null,
      transfer_to_wallet_id: null,
      linked_transaction_id: null,
      debt_activity_id: id,
      analysis_excluded: true,
      description: cashDescription(
        debt.direction,
        cashKind,
        debt.counterpartyName,
      ),
      merchant: null,
      notes: data.note ?? null,
      transaction_date: activityDate,
      location_latitude: null,
      location_longitude: null,
      location_name: null,
      receipt_image_url: null,
      metadata: { debt_activity_id: id },
      deleted: false,
    });
  }
  const activity = mapActivity({
    id,
    user_id: userId,
    debt_id: debt.id,
    kind: data.kind,
    amount: data.amount,
    activity_date: activityDate,
    wallet_id: data.walletId ?? null,
    cash_transaction_id: cashTransactionId,
    note: data.note ?? null,
    created_at: now,
    updated_at: now,
  });
  await setDebtStatus(debt, [activity, ...activities]);
  return activity;
}

export async function createDebt(data: {
  counterpartyName: string;
  direction: DebtDirection;
  amount: number;
  walletId: string;
  dueDate?: string | null;
  note?: string | null;
  activityDate?: string;
}): Promise<Debt> {
  const parsed = createDebtInputSchema.safeParse(data);
  if (!parsed.success)
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid debt");
  data = parsed.data;
  const userId = await getUserId();
  const name = data.counterpartyName.trim();
  if (!userId) throw new Error("Not authenticated");
  if (!name) throw new Error("Enter a person’s name");
  const now = new Date().toISOString();
  const currency = walletCurrency(data.walletId);
  const id = randomUUID();
  debts$[id].set({
    id,
    user_id: userId,
    counterparty_name: name,
    direction: data.direction,
    currency,
    due_date: data.dueDate ?? null,
    note: data.note ?? null,
    status: "open",
    deleted: false,
  });
  const debt = mapDebt({
    id,
    user_id: userId,
    counterparty_name: name,
    direction: data.direction,
    currency,
    due_date: data.dueDate ?? null,
    note: data.note ?? null,
    status: "open",
    created_at: now,
    updated_at: now,
  });
  await addActivity(debt, {
    kind: "principal",
    amount: data.amount,
    walletId: data.walletId,
    note: data.note,
    activityDate: data.activityDate,
  });
  return debt;
}

export async function addDebtPrincipal(
  debt: Debt,
  amount: number,
  walletId: string,
  note?: string | null,
) {
  const parsed = createDebtActivityInputSchema.safeParse({
    kind: "principal",
    amount,
    walletId,
    note,
  });
  if (!parsed.success)
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid debt activity");
  return addActivity(debt, parsed.data);
}
export async function repayDebt(
  debt: Debt,
  amount: number,
  walletId: string,
  note?: string | null,
) {
  const parsed = createDebtActivityInputSchema.safeParse({
    kind: "repayment",
    amount,
    walletId,
    note,
  });
  if (!parsed.success)
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid debt activity");
  return addActivity(debt, parsed.data);
}
export async function writeOffDebt(debt: Debt, note?: string | null) {
  const activities = await getDebtActivities(debt.id);
  return addActivity(debt, {
    kind: "write_off",
    amount: outstandingDebtBalance(activities),
    note,
  });
}

export async function deleteDebtActivity(
  debt: Debt,
  activityId: string,
): Promise<void> {
  const activity = (await getDebtActivities(debt.id)).find(
    (item) => item.id === activityId,
  );
  if (!activity) throw new Error("Debt activity not found");
  const now = new Date().toISOString();
  patchRow(debtActivities$, activity.id, { deleted: true, updated_at: now });
  if (activity.cashTransactionId)
    patchRow(transactions$, activity.cashTransactionId, {
      deleted: true,
      updated_at: now,
    });
  const remaining = (await getDebtActivities(debt.id)).filter(
    (item) => item.id !== activity.id,
  );
  await setDebtStatus(debt, remaining);
}

/** Idempotently reconstruct a missing local cash mirror after an interrupted offline write. */
export async function reconcileDebtTransactions(): Promise<number> {
  const debts = await getDebts();
  const activities = await getDebtActivities();
  let repaired = 0;
  const txIds = new Set(
    getRecordValues<{ id: string }>(transactions$).map(
      (transaction) => transaction.id,
    ),
  );
  for (const activity of activities) {
    if (
      !activity.cashTransactionId ||
      !activity.walletId ||
      txIds.has(activity.cashTransactionId)
    )
      continue;
    const debt = debts.find((item) => item.id === activity.debtId);
    if (!debt || activity.kind === "write_off") continue;
    const userId = await getUserId();
    if (!userId) break;
    transactions$[activity.cashTransactionId].set({
      id: activity.cashTransactionId,
      user_id: userId,
      wallet_id: activity.walletId,
      amount: activity.amount,
      currency: debt.currency,
      type: cashType(debt.direction, activity.kind),
      category_id: null,
      transfer_to_wallet_id: null,
      linked_transaction_id: null,
      debt_activity_id: activity.id,
      analysis_excluded: true,
      description: cashDescription(
        debt.direction,
        activity.kind,
        debt.counterpartyName,
      ),
      merchant: null,
      notes: activity.note,
      transaction_date: activity.activityDate,
      location_latitude: null,
      location_longitude: null,
      location_name: null,
      receipt_image_url: null,
      metadata: { debt_activity_id: activity.id },
      deleted: false,
    });
    repaired += 1;
  }
  return repaired;
}
