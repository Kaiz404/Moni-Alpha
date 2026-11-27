import type { RecurringOverride, UpcomingBill } from '@repo/types';

import {
  addMonths,
  type Calendar,
  dayFromNumber,
  dayNumber,
  dayOfMonth,
  type DayKey,
  firstDayOf,
  monthOf,
  shiftMonth,
} from '../calendar';
import { countsAsCashFlow } from '../ledger';
import { detectRecurring, seriesKey, type FactsTransaction } from './recurring';

const NOON_MS = 12 * 60 * 60 * 1000;

/** Each series' latest payment, for the wallet it pays from and the category it lands in. */
export function lastPaymentBySeries<T extends FactsTransaction>(
  transactions: readonly T[],
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const tx of transactions) {
    if (!countsAsCashFlow(tx)) continue;
    const key = seriesKey(tx);
    if (!key) continue;
    const current = latest.get(key);
    if (!current || tx.transactionDate > current.transactionDate) latest.set(key, tx);
  }
  return latest;
}

/** Payments that belong to a bill, newest first. */
export function billPayments<T extends FactsTransaction>(
  transactions: readonly T[],
  key: string,
): T[] {
  return transactions
    .filter((tx) => countsAsCashFlow(tx) && seriesKey(tx) === key)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/**
 * This month's bills: detected expense series plus confirmed bills the user added, each
 * `due`, `paid` once a payment in the series landed this month, or `skipped` for the month.
 * The user's own name, amount, day, wallet and category win over what detection saw.
 */
export function selectUpcomingBills(
  now: Date,
  transactions: readonly FactsTransaction[],
  overrides: readonly RecurringOverride[],
  calendar: Calendar,
): UpcomingBill[] {
  const todayKey = calendar.dayKey(now);
  const period = monthOf(todayKey);
  const monthStart = dayNumber(firstDayOf(period));
  const monthEnd = dayNumber(firstDayOf(shiftMonth(period, 1)));
  const inMonth = (day: number) => day >= monthStart && day < monthEnd;
  const verdicts = new Map(overrides.map((override) => [override.seriesKey, override]));
  const latest = lastPaymentBySeries(transactions);
  const paidThisMonth = new Set(
    transactions
      .filter((tx) => countsAsCashFlow(tx) && inMonth(calendar.dayNumber(tx.transactionDate)))
      .map((tx) => seriesKey(tx)),
  );

  const bill = (
    key: string,
    fallback: Pick<UpcomingBill, 'name' | 'amountMinor' | 'currency' | 'dueDate'>,
    paid: boolean,
  ): UpcomingBill => {
    const override = verdicts.get(key);
    const last = latest.get(key);
    return {
      seriesKey: key,
      name: override?.name ?? fallback.name,
      amountMinor: override?.expectedAmountMinor ?? fallback.amountMinor,
      currency: fallback.currency,
      dueDate: override?.expectedDay
        ? addMonths(todayKey, 0, override.expectedDay)
        : fallback.dueDate,
      status: override?.skipPeriod === period ? 'skipped' : paid ? 'paid' : 'due',
      walletId: override?.walletId ?? last?.walletId ?? null,
      categoryId: override?.categoryId ?? last?.categoryId ?? null,
    };
  };

  const bills = new Map<string, UpcomingBill>();
  for (const series of detectRecurring(transactions, overrides, now, calendar)) {
    if (series.type !== 'expense') continue;
    const due = inMonth(series.nextExpectedDay);
    if (!due && !inMonth(series.lastDay)) continue;
    bills.set(
      series.key,
      bill(
        series.key,
        {
          name: series.label,
          amountMinor: series.expectedAmountMinor,
          currency: series.currency,
          dueDate: dayFromNumber(due ? series.nextExpectedDay : series.lastDay),
        },
        !due,
      ),
    );
  }

  for (const override of overrides) {
    if (override.status !== 'confirmed' || bills.has(override.seriesKey)) continue;
    if (override.kind !== 'bill' && override.kind !== 'subscription') continue;
    if (!override.expectedDay || !override.expectedAmountMinor) continue;
    if (override.dueOnce && !inMonth(dayNumber(override.dueOnce))) continue;
    bills.set(override.seriesKey, {
      ...bill(
        override.seriesKey,
        {
          name: override.seriesKey.split('|')[2]!,
          amountMinor: override.expectedAmountMinor,
          currency: override.currency,
          dueDate: addMonths(todayKey, 0, override.expectedDay),
        },
        paidThisMonth.has(override.seriesKey),
      ),
      ...(override.dueOnce ? { dueDate: override.dueOnce } : {}),
    });
  }

  return [...bills.values()].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name),
  );
}

/**
 * This month's bills and then next month's, for planning what comes next: on the 30th a bill
 * due on the 1st is already next month's, and a bill paid this month comes round again.
 */
export function selectBillsAhead(
  now: Date,
  transactions: readonly FactsTransaction[],
  overrides: readonly RecurringOverride[],
  calendar: Calendar,
): UpcomingBill[] {
  const nextMonth = new Date(
    calendar.startOfDay(firstDayOf(shiftMonth(calendar.monthKey(now), 1))).getTime() + NOON_MS,
  );
  return [
    ...selectUpcomingBills(now, transactions, overrides, calendar),
    ...selectUpcomingBills(nextMonth, transactions, overrides, calendar),
  ];
}

/** What a payment's page says about bills (#136): it is one, or it can become one. */
export type PaymentBill =
  | { kind: 'bill'; seriesKey: string; once: boolean }
  /** `likely` when it looks like a bill, so the page shows the offer and not only its menus. */
  | { kind: 'offer'; seriesKey: string; likely: boolean };

const BILL_CATEGORY = /\b(bills?|utilit|subscri|internet|phone|mobile|insurance|rent|electric|water)/i;
/** A payment to the same merchant this many days before or after reads as a monthly charge. */
const MONTH_APART = { min: 27, max: 34 };

/**
 * Whether `payment` is already one of this month's bills, or could become one. Only an expense with
 * a merchant can, since a bill is a series of one merchant's charges.
 */
export function paymentBill(
  payment: FactsTransaction,
  transactions: readonly FactsTransaction[],
  overrides: readonly RecurringOverride[],
  now: Date,
  calendar: Calendar,
  categoryName: string | null,
): PaymentBill | null {
  if (payment.type !== 'expense' || !countsAsCashFlow(payment)) return null;
  const key = seriesKey(payment);
  if (!key) return null;
  if (selectUpcomingBills(now, transactions, overrides, calendar).some((bill) => bill.seriesKey === key)) {
    const override = overrides.find((each) => each.seriesKey === key);
    return { kind: 'bill', seriesKey: key, once: !!override?.dueOnce };
  }
  const day = calendar.dayNumber(payment.transactionDate);
  const monthApart = transactions.some((tx) => {
    if (!countsAsCashFlow(tx) || seriesKey(tx) !== key) return false;
    const gap = Math.abs(calendar.dayNumber(tx.transactionDate) - day);
    return gap >= MONTH_APART.min && gap <= MONTH_APART.max;
  });
  return {
    kind: 'offer',
    seriesKey: key,
    likely: monthApart || (!!categoryName && BILL_CATEGORY.test(categoryName)),
  };
}

/** A bill made from a payment is due on the payment's day of the month, next after it and today. */
export function billDueFrom(payment: DayKey, today: DayKey): DayKey {
  const day = dayOfMonth(payment);
  const thisMonth = addMonths(today, 0, day);
  return thisMonth <= payment || thisMonth < today ? addMonths(today, 1, day) : thisMonth;
}
