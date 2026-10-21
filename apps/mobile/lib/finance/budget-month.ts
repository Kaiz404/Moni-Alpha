import type { CurrencyCode, MinorAmount, UpcomingBill } from '@repo/types';

import { formatMoney } from '@/lib/finance/format-money';
import type {
  FinanceBudget,
  FinanceCategory,
  FinanceDebt,
  FinanceTransaction,
} from '@/lib/finance/types';

/** `YYYY-MM` in device-local time, the month the Budget tab shows. */
export type MonthKey = string;

export type CategorySpend = {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: MinorAmount;
  budgetMinor: MinorAmount | null;
};

export type DebtDue = { name: string; amountMinor: MinorAmount };

/** D1: what is left of the month's budget after spending, bills still due, and debts due. */
export type LeftThisMonth = {
  leftMinor: MinorAmount;
  daysLeft: number;
  /** Whole money per day for the days left; 0 once nothing is left. */
  perDayMinor: MinorAmount;
  billsMinor: MinorAmount;
  debtsDue: DebtDue[];
};

export type BudgetMonth = {
  month: MonthKey;
  currency: CurrencyCode;
  isCurrent: boolean;
  daysInMonth: number;
  /** The line runs to this day: today in the current month, the last day otherwise. */
  throughDay: number;
  /** Spend per day, index 0 is day 1. Days after `throughDay` are 0. */
  daily: MinorAmount[];
  /** Spend so far, index 0 is before day 1; length `throughDay + 1`. */
  cumulative: MinorAmount[];
  spentMinor: MinorAmount;
  budgetMinor: MinorAmount | null;
  evenPaceMinor: MinorAmount | null;
  budgeted: CategorySpend[];
  /** Categories spent in this month with no budget. */
  unbudgeted: CategorySpend[];
  /** Bills still due this month in this currency; empty for past months. */
  billsDue: UpcomingBill[];
  left: LeftThisMonth | null;
};

export type BudgetMonthInput = {
  month: MonthKey;
  now: Date;
  currency: CurrencyCode;
  transactions: readonly FinanceTransaction[];
  categories: readonly FinanceCategory[];
  budgets: readonly FinanceBudget[];
  /** The user's monthly total; null falls back to the sum of category budgets. */
  monthlyTotalMinor: MinorAmount | null;
  bills: readonly UpcomingBill[];
  debts: readonly { debt: FinanceDebt; balanceMinor: MinorAmount }[];
};

const pad = (value: number) => String(value).padStart(2, '0');

export function monthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function daysInMonth(month: MonthKey): number {
  const [year, number] = month.split('-').map(Number);
  return new Date(year, number, 0).getDate();
}

export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [year, number] = month.split('-').map(Number);
  return monthKey(new Date(year, number - 1 + by, 1));
}

/** Spending the Budget tab counts: the user's own expenses, not transfers or debt mirrors. */
export function countsAsSpend(transaction: FinanceTransaction, currency: CurrencyCode): boolean {
  return (
    transaction.type === 'expense' &&
    !transaction.analysisExcluded &&
    transaction.currency === currency
  );
}

function localDay(value: string): { month: MonthKey; day: number } {
  const date = new Date(value);
  return { month: monthKey(date), day: date.getDate() };
}

/** Each day's spend for one month (index 0 is day 1) and where the line stops. */
export function dailySpend(
  transactions: readonly FinanceTransaction[],
  month: MonthKey,
  now: Date,
): { daily: MinorAmount[]; throughDay: number; isCurrent: boolean } {
  const length = daysInMonth(month);
  const isCurrent = month === monthKey(now);
  const daily = Array.from({ length }, () => 0);
  for (const transaction of transactions) {
    const at = localDay(transaction.transactionDate);
    if (at.month === month) daily[at.day - 1] += Number(transaction.amountMinor);
  }
  return {
    daily: daily as MinorAmount[],
    throughDay: isCurrent ? now.getDate() : length,
    isCurrent,
  };
}

export function cumulativeSpend(daily: readonly MinorAmount[], throughDay: number): MinorAmount[] {
  const cumulative = [0];
  for (let day = 1; day <= throughDay; day += 1)
    cumulative.push(cumulative[day - 1] + Number(daily[day - 1] ?? 0));
  return cumulative as MinorAmount[];
}

function byDisplayOrder(categories: readonly FinanceCategory[]) {
  const rank = new Map(categories.map((category, index) => [category.id, index]));
  return (a: CategorySpend, b: CategorySpend) =>
    (rank.get(a.categoryId) ?? 0) - (rank.get(b.categoryId) ?? 0);
}

export function buildBudgetMonth(input: BudgetMonthInput): BudgetMonth {
  const { month, now, currency } = input;
  const spend = input.transactions.filter(
    (transaction) =>
      countsAsSpend(transaction, currency) && localDay(transaction.transactionDate).month === month,
  );
  const { daily, throughDay, isCurrent } = dailySpend(spend, month, now);
  const cumulative = cumulativeSpend(daily, throughDay);
  const spentMinor = daily.reduce((sum, value) => sum + value, 0) as MinorAmount;

  const sortedCategories = [...input.categories].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  const categoriesById = new Map(sortedCategories.map((category) => [category.id, category]));
  const spentByCategory = new Map<string, number>();
  for (const transaction of spend) {
    if (!transaction.categoryId) continue;
    spentByCategory.set(
      transaction.categoryId,
      (spentByCategory.get(transaction.categoryId) ?? 0) + Number(transaction.amountMinor),
    );
  }
  const budgets = input.budgets.filter(
    (budget) => budget.currency === currency && categoriesById.has(budget.categoryId),
  );
  const budgetByCategory = new Map(
    budgets.map((budget) => [budget.categoryId, budget.amountMinor]),
  );
  const toSpend = (category: FinanceCategory): CategorySpend => ({
    categoryId: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    spentMinor: (spentByCategory.get(category.id) ?? 0) as MinorAmount,
    budgetMinor: budgetByCategory.get(category.id) ?? null,
  });
  const order = byDisplayOrder(sortedCategories);
  const budgeted = budgets
    .map((budget) => toSpend(categoriesById.get(budget.categoryId)!))
    .sort(order);
  const unbudgeted = [...spentByCategory.keys()]
    .filter((id) => !budgetByCategory.has(id) && categoriesById.has(id))
    .map((id) => toSpend(categoriesById.get(id)!))
    .sort(order);

  const capsMinor = budgets.reduce((sum, budget) => sum + Number(budget.amountMinor), 0);
  const budgetMinor = (input.monthlyTotalMinor ??
    (capsMinor > 0 ? capsMinor : null)) as MinorAmount | null;
  const length = daysInMonth(month);
  const evenPaceMinor =
    budgetMinor === null ? null : (Math.floor(budgetMinor / length) as MinorAmount);

  const billsDue = isCurrent
    ? input.bills.filter((bill) => bill.status === 'due' && bill.currency === currency)
    : [];
  const left =
    isCurrent && budgetMinor !== null
      ? leftThisMonth({
          budgetMinor,
          spentMinor,
          billsDue,
          debts: input.debts,
          currency,
          month,
          daysLeft: length - now.getDate() + 1,
        })
      : null;

  return {
    month,
    currency,
    isCurrent,
    daysInMonth: length,
    throughDay,
    daily,
    cumulative,
    spentMinor,
    budgetMinor,
    evenPaceMinor,
    budgeted,
    unbudgeted,
    billsDue,
    left,
  };
}

function leftThisMonth({
  budgetMinor,
  spentMinor,
  billsDue,
  debts,
  currency,
  month,
  daysLeft,
}: {
  budgetMinor: MinorAmount;
  spentMinor: MinorAmount;
  billsDue: readonly UpcomingBill[];
  debts: BudgetMonthInput['debts'];
  currency: CurrencyCode;
  month: MonthKey;
  daysLeft: number;
}): LeftThisMonth {
  const monthEnd = `${month}-${pad(daysInMonth(month))}`;
  const debtsDue = debts
    .filter(
      ({ debt, balanceMinor }) =>
        debt.direction === 'i_owe' &&
        debt.status === 'open' &&
        debt.currency === currency &&
        debt.dueDate !== null &&
        debt.dueDate <= monthEnd &&
        balanceMinor > 0,
    )
    .map(({ debt, balanceMinor }) => ({
      name: debt.counterpartyName,
      amountMinor: balanceMinor,
    }));
  const billsMinor = billsDue.reduce((sum, bill) => sum + Number(bill.amountMinor), 0);
  const debtsMinor = debtsDue.reduce((sum, debt) => sum + Number(debt.amountMinor), 0);
  const leftMinor = budgetMinor - spentMinor - billsMinor - debtsMinor;
  return {
    leftMinor: leftMinor as MinorAmount,
    daysLeft,
    perDayMinor: (leftMinor > 0 ? Math.floor(leftMinor / daysLeft / 100) * 100 : 0) as MinorAmount,
    billsMinor: billsMinor as MinorAmount,
    debtsDue,
  };
}

/** "after bills and RM40 to Mei", or null when nothing is set aside. */
export function setAsideLabel(left: LeftThisMonth, currency: string): string | null {
  const parts: string[] = [];
  if (left.billsMinor > 0) parts.push('bills');
  if (left.debtsDue.length) {
    const total = left.debtsDue.reduce((sum, debt) => sum + Number(debt.amountMinor), 0);
    const who =
      left.debtsDue.length === 1 ? left.debtsDue[0].name : `${left.debtsDue.length} people`;
    parts.push(`${formatMoney(total, currency, { whole: true })} to ${who}`);
  }
  return parts.length ? `after ${parts.join(' and ')}` : null;
}

/** The line under "Spent in October": what is left, after what, and safe to spend a day. */
export function leftSentence(month: BudgetMonth): string | null {
  const { budgetMinor, spentMinor, currency, left } = month;
  if (budgetMinor === null) return null;
  const whole = (value: number) => formatMoney(value, currency, { whole: true });
  if (!left) {
    const under = budgetMinor - spentMinor;
    return under >= 0
      ? `${whole(under)} under the ${whole(budgetMinor)} budget`
      : `${whole(-under)} over the ${whole(budgetMinor)} budget`;
  }
  const after = setAsideLabel(left, currency);
  if (left.leftMinor < 0)
    return [`${whole(-left.leftMinor)} over`, after].filter(Boolean).join(' ');
  const days = left.daysLeft === 1 ? '1 day' : `${left.daysLeft} days`;
  return `${[`${whole(left.leftMinor)} left for ${days}`, after].filter(Boolean).join(' ')} · ${whole(left.perDayMinor)} a day`;
}

/** Months the chooser offers, newest first: this month and every earlier month with spend. */
export function spendMonths(
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  now: Date,
  limit = 12,
): { month: MonthKey; spentMinor: MinorAmount }[] {
  const current = monthKey(now);
  const totals = new Map<MonthKey, number>([[current, 0]]);
  for (const transaction of transactions) {
    if (!countsAsSpend(transaction, currency)) continue;
    const { month } = localDay(transaction.transactionDate);
    if (month > current) continue;
    totals.set(month, (totals.get(month) ?? 0) + Number(transaction.amountMinor));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([month, spentMinor]) => ({ month, spentMinor: spentMinor as MinorAmount }));
}

export type MerchantSpend = {
  name: string;
  payments: number;
  spentMinor: MinorAmount;
  /** The wallet most of these payments came from. */
  walletId: string;
};

/** The biggest merchants among some spending, by total. */
export function topMerchants(
  transactions: readonly FinanceTransaction[],
  limit: number,
): { merchants: MerchantSpend[]; count: number } {
  const byName = new Map<string, MerchantSpend & { wallets: Map<string, number> }>();
  for (const transaction of transactions) {
    const name = transaction.merchant ?? transaction.description;
    if (!name) continue;
    const entry = byName.get(name) ?? {
      name,
      payments: 0,
      spentMinor: 0 as MinorAmount,
      walletId: transaction.walletId,
      wallets: new Map<string, number>(),
    };
    entry.payments += 1;
    entry.spentMinor = (entry.spentMinor + Number(transaction.amountMinor)) as MinorAmount;
    entry.wallets.set(transaction.walletId, (entry.wallets.get(transaction.walletId) ?? 0) + 1);
    byName.set(name, entry);
  }
  const merchants = [...byName.values()]
    .sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name))
    .map(({ wallets, ...merchant }) => ({
      ...merchant,
      walletId: [...wallets.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }));
  return { merchants: merchants.slice(0, limit), count: merchants.length };
}

/** A month's spending in one currency, newest first; `categoryId` narrows it to one category. */
export function monthSpend(
  transactions: readonly FinanceTransaction[],
  month: MonthKey,
  currency: CurrencyCode,
  categoryId?: string,
): FinanceTransaction[] {
  return transactions
    .filter(
      (transaction) =>
        countsAsSpend(transaction, currency) &&
        (categoryId === undefined || transaction.categoryId === categoryId) &&
        localDay(transaction.transactionDate).month === month,
    )
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/** Day of month for a transaction in device-local time. */
export function dayOfMonth(transaction: Pick<FinanceTransaction, 'transactionDate'>): number {
  return localDay(transaction.transactionDate).day;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthName(month: MonthKey): string {
  return MONTH_NAMES[Number(month.split('-')[1]) - 1];
}

/** "Oct" as dates write it. */
export function monthShort(month: MonthKey): string {
  return monthName(month).slice(0, 3);
}
