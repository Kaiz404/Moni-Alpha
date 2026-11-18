import {
  decimalToMinor,
  type CurrencyCode,
  type MinorAmount,
  type RecurringOverride,
  type UpcomingBill,
} from '@repo/types';

import {
  type Calendar,
  dayOfMonth,
  daysInMonth,
  lastDayOf,
  type MonthKey,
  monthOf,
} from '../calendar';
import { countsAsSpending } from '../ledger';
import { monthSpend } from '../read-model/report';
import type { DebtWithBalance } from '../read-model/selections';
import type { FinanceBudget, FinanceCategory, FinanceTransaction } from '../read-model/types';
import { selectUpcomingBills } from './bills';
import { daysAtOrUnderPace, evenPace, safePerDay } from './pace';
import { debtPhrase, leftLine, leftSentence } from './words';

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

/** The month's ready sentences; each is null where it does not apply. See `words.ts`. */
export type MoneyMonthWords = {
  /** Budget tab: "RM443 left for 18 days after bills and RM40 to Mei · RM24 a day". */
  budgetLine: string | null;
  /** Home's spent card: names debts due only when no bills strip carries them. */
  homeLine: string | null;
  /** New transaction's empty amount: "RM443 left for 18 days · RM24 a day". */
  leftLine: string | null;
  /** "RM40 to Mei", or "RM60 to 2 people". */
  debts: string | null;
};

export type MoneyMonth = {
  month: MonthKey;
  currency: CurrencyCode;
  isCurrent: boolean;
  daysInMonth: number;
  /** Today to the month's last day, both counted, in the current month; 0 for another month. */
  daysLeft: number;
  /** The line runs to this day: today in the current month, the last day otherwise. */
  throughDay: number;
  /** Spend per day, index 0 is day 1. Days after `throughDay` are 0. */
  daily: MinorAmount[];
  /** Spend so far, index 0 is before day 1; length `throughDay + 1`. */
  cumulative: MinorAmount[];
  spentMinor: MinorAmount;
  budgetMinor: MinorAmount | null;
  evenPaceMinor: MinorAmount | null;
  /** Of days 1 to `throughDay`, those spent at or under even pace; null without a budget. */
  paceDays: { atOrUnder: number; counted: number } | null;
  budgeted: CategorySpend[];
  /** Categories spent in this month with no budget. */
  unbudgeted: CategorySpend[];
  /** Bills still due this month in this currency; empty for past months. */
  billsDue: UpcomingBill[];
  left: LeftThisMonth | null;
  words: MoneyMonthWords;
};

/** The synced rows a money month reads, as stored. */
export type MoneyLedgerRows = {
  userId: string | null;
  transactions: readonly FinanceTransaction[];
  categoriesById: Record<string, FinanceCategory>;
  budgetsById: Record<string, FinanceBudget>;
  /** `profile_preferences.monthly_budget`: a decimal, or null when the user set none. */
  monthlyBudget: string | number | null | undefined;
  overrides: readonly RecurringOverride[];
  debts: readonly DebtWithBalance[];
};

/** One user's ledger, ready for any month. */
export type MoneyLedger = {
  transactions: readonly FinanceTransaction[];
  /** The user's and the preset expense categories still in use. */
  categories: readonly FinanceCategory[];
  budgets: readonly FinanceBudget[];
  /** The user's monthly total; null falls back to the sum of category budgets. */
  monthlyTotalMinor: MinorAmount | null;
  /** This month's bills. */
  bills: readonly UpcomingBill[];
  overrides: readonly RecurringOverride[];
  debts: readonly DebtWithBalance[];
};

export function moneyLedger(rows: MoneyLedgerRows, now: Date, calendar: Calendar): MoneyLedger {
  const { userId } = rows;
  const transactions = rows.transactions.filter((transaction) => transaction.userId === userId);
  return {
    transactions,
    categories: Object.values(rows.categoriesById).filter(
      (category) =>
        (category.userId === null || category.userId === userId) &&
        category.isActive &&
        category.type !== 'income',
    ),
    budgets: Object.values(rows.budgetsById).filter((budget) => budget.userId === userId),
    monthlyTotalMinor: rows.monthlyBudget == null ? null : decimalToMinor(rows.monthlyBudget),
    bills: selectUpcomingBills(now, transactions, rows.overrides, calendar),
    overrides: rows.overrides,
    debts: rows.debts,
  };
}

/** Each day's spend for one month (index 0 is day 1) and where the line stops. */
export function dailySpend(
  transactions: readonly FinanceTransaction[],
  month: MonthKey,
  now: Date,
  calendar: Calendar,
): { daily: MinorAmount[]; throughDay: number; isCurrent: boolean } {
  const length = daysInMonth(month);
  const today = calendar.dayKey(now);
  const isCurrent = month === monthOf(today);
  const daily = Array.from({ length }, () => 0);
  for (const transaction of transactions) {
    const day = calendar.dayKey(transaction.transactionDate);
    if (monthOf(day) === month) daily[dayOfMonth(day) - 1]! += Number(transaction.amountMinor);
  }
  return {
    daily: daily as MinorAmount[],
    throughDay: isCurrent ? dayOfMonth(today) : length,
    isCurrent,
  };
}

export function cumulativeSpend(daily: readonly MinorAmount[], throughDay: number): MinorAmount[] {
  const cumulative = [0];
  for (let day = 1; day <= throughDay; day += 1)
    cumulative.push(cumulative[day - 1]! + Number(daily[day - 1] ?? 0));
  return cumulative as MinorAmount[];
}

function byDisplayOrder(categories: readonly FinanceCategory[]) {
  const rank = new Map(categories.map((category, index) => [category.id, index]));
  return (a: CategorySpend, b: CategorySpend) =>
    (rank.get(a.categoryId) ?? 0) - (rank.get(b.categoryId) ?? 0);
}

export function buildMoneyMonth(
  ledger: MoneyLedger,
  {
    month,
    currency,
    now,
    calendar,
  }: { month: MonthKey; currency: CurrencyCode; now: Date; calendar: Calendar },
): MoneyMonth {
  const spend = ledger.transactions.filter(
    (transaction) =>
      transaction.currency === currency &&
      countsAsSpending(transaction) &&
      calendar.monthKey(transaction.transactionDate) === month,
  );
  const { daily, throughDay, isCurrent } = dailySpend(spend, month, now, calendar);
  const cumulative = cumulativeSpend(daily, throughDay);
  const spentMinor = daily.reduce((sum, value) => sum + value, 0) as MinorAmount;

  const sortedCategories = [...ledger.categories].sort(
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
  const budgets = ledger.budgets.filter(
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
  const budgetMinor = (ledger.monthlyTotalMinor ??
    (capsMinor > 0 ? capsMinor : null)) as MinorAmount | null;
  const length = daysInMonth(month);
  const evenPaceMinor = budgetMinor === null ? null : evenPace(budgetMinor, month);
  const daysLeft = isCurrent ? length - dayOfMonth(calendar.dayKey(now)) + 1 : 0;

  const billsDue = isCurrent
    ? ledger.bills.filter((bill) => bill.status === 'due' && bill.currency === currency)
    : [];
  const left =
    isCurrent && budgetMinor !== null
      ? leftThisMonth({
          budgetMinor,
          spentMinor,
          billsDue,
          debts: ledger.debts,
          currency,
          month,
          daysLeft,
        })
      : null;

  const debts = debtPhrase(left?.debtsDue ?? [], currency);
  const shape = { budgetMinor, spentMinor, currency, left };
  return {
    month,
    currency,
    isCurrent,
    daysInMonth: length,
    daysLeft,
    throughDay,
    daily,
    cumulative,
    spentMinor,
    budgetMinor,
    evenPaceMinor,
    paceDays:
      evenPaceMinor === null
        ? null
        : {
            atOrUnder: daysAtOrUnderPace(daily.slice(0, throughDay), evenPaceMinor),
            counted: throughDay,
          },
    budgeted,
    unbudgeted,
    billsDue,
    left,
    words: {
      budgetLine: leftSentence(shape),
      homeLine: left ? leftLine(left, currency, billsDue.length ? null : debts) : null,
      leftLine: left ? leftLine(left, currency) : null,
      debts,
    },
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
  debts: readonly DebtWithBalance[];
  currency: CurrencyCode;
  month: MonthKey;
  daysLeft: number;
}): LeftThisMonth {
  const monthEnd = lastDayOf(month);
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
    perDayMinor: safePerDay(leftMinor, daysLeft),
    billsMinor: billsMinor as MinorAmount,
    debtsDue,
  };
}

/** Months the chooser offers, newest first: this month and every earlier month with spend. */
export function spendMonths(
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  now: Date,
  calendar: Calendar,
  limit = 12,
): { month: MonthKey; spentMinor: MinorAmount }[] {
  const current = calendar.monthKey(now);
  const totals = new Map<MonthKey, number>([[current, 0]]);
  for (const transaction of transactions) {
    if (transaction.currency !== currency || !countsAsSpending(transaction)) continue;
    const month = calendar.monthKey(transaction.transactionDate);
    if (month > current) continue;
    totals.set(month, (totals.get(month) ?? 0) + Number(transaction.amountMinor));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([month, spentMinor]) => ({ month, spentMinor: spentMinor as MinorAmount }));
}

export type SpendSlice = {
  /** Null for spending with no category. */
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: MinorAmount;
};

/**
 * A month's spending split by category, biggest first, adding up to `buildMoneyMonth`'s `spentMinor`.
 * `categories` has to include archived ones: old spending still belongs to them.
 */
export function spendSlices(
  transactions: readonly FinanceTransaction[],
  month: MonthKey,
  currency: CurrencyCode,
  categories: readonly Pick<FinanceCategory, 'id' | 'name' | 'icon' | 'color'>[],
  calendar: Calendar,
): SpendSlice[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const totals = new Map<string | null, number>();
  for (const transaction of monthSpend(transactions, month, currency, calendar)) {
    const id =
      transaction.categoryId && byId.has(transaction.categoryId) ? transaction.categoryId : null;
    totals.set(id, (totals.get(id) ?? 0) + Number(transaction.amountMinor));
  }
  return [...totals]
    .map(([categoryId, spentMinor]) => {
      const category = categoryId ? byId.get(categoryId) : undefined;
      return {
        categoryId,
        name: category?.name ?? 'No category',
        icon: category?.icon ?? null,
        color: category?.color ?? null,
        spentMinor: spentMinor as MinorAmount,
      };
    })
    .sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name));
}
