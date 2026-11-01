import { addMinor, minorToNumber, type CurrencyCode, type MinorAmount } from '@repo/types';

import { formatDate } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { daysInMonth, monthKey, monthShort, shiftMonth, type MonthKey } from '@/lib/finance/budget-month';
import type { FinanceTransaction } from '@/lib/finance/types';

export type ActivityKind = 'all' | FinanceTransaction['type'];

/** Local `YYYY-MM-DD`, both ends included. Where one is expected, null means all time. */
export type ActivityRange = { from: string; to: string };

export type ActivityFilter = {
  query: string;
  /** Null shows every wallet; a wallet also matches transfers into it. */
  walletId: string | null;
  mainCurrency: CurrencyCode;
  kind: ActivityKind;
  categoryNames: Readonly<Record<string, string>>;
};

export type ActivityDay = {
  /** Local `YYYY-MM-DD`. */
  key: string;
  transactions: FinanceTransaction[];
  spentMinor: MinorAmount;
  inMinor: MinorAmount;
};

function matchesQuery(
  transaction: FinanceTransaction,
  query: string,
  categoryNames: ActivityFilter['categoryNames'],
): boolean {
  const text = [
    transaction.merchant,
    transaction.description,
    transaction.notes,
    transaction.categoryId ? categoryNames[transaction.categoryId] : null,
  ];
  if (text.some((value) => value?.toLowerCase().includes(query))) return true;
  const amount = query.replace(/^rm/, '').replaceAll(',', '');
  return (
    /^\d+(\.\d*)?$/.test(amount) &&
    minorToNumber(transaction.amountMinor).toFixed(2).startsWith(amount)
  );
}

/**
 * The rows Activity shows, newest first: main currency only, then the wallet and kind filters,
 * then a case-insensitive match on merchant, description, note, category name, or the start of
 * the amount.
 */
export function filterActivity(
  transactions: readonly FinanceTransaction[],
  filter: ActivityFilter,
): FinanceTransaction[] {
  const query = filter.query.trim().toLowerCase();
  const kept: { at: number; transaction: FinanceTransaction }[] = [];
  for (const transaction of transactions) {
    if (
      transaction.currency === filter.mainCurrency &&
      (filter.walletId === null ||
        transaction.walletId === filter.walletId ||
        transaction.transferToWalletId === filter.walletId) &&
      (filter.kind === 'all' || transaction.type === filter.kind) &&
      (query === '' || matchesQuery(transaction, query, filter.categoryNames))
    ) {
      kept.push({ at: new Date(transaction.transactionDate).getTime(), transaction });
    }
  }
  // Numbers, not localeCompare: Hermes pays for a collator on every comparison of a large sort.
  kept.sort((a, b) => b.at - a.at);
  return kept.map((row) => row.transaction);
}

/** Midnight at the start of a local `YYYY-MM-DD`. */
export function localDay(key: string, addDays = 0): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day + addDays);
}

/** The rows inside a range, in the order given. A null range keeps them all. */
export function withinRange(
  transactions: readonly FinanceTransaction[],
  range: ActivityRange | null,
): readonly FinanceTransaction[] {
  if (!range) return transactions;
  const start = localDay(range.from).getTime();
  const end = localDay(range.to, 1).getTime();
  return transactions.filter((transaction) => {
    const at = new Date(transaction.transactionDate).getTime();
    return at >= start && at < end;
  });
}

/** Two picked days as a range; ends picked the wrong way round swap. */
export function orderRange(a: string, b: string): ActivityRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function sameRange(a: ActivityRange | null, b: ActivityRange | null): boolean {
  return a?.from === b?.from && a?.to === b?.to;
}

export function monthRange(month: MonthKey): ActivityRange {
  return {
    from: `${month}-01`,
    to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}`,
  };
}

export type RangePreset = { key: string; label: string; range: ActivityRange | null };

/** The date sheet's choices, in the order it shows them. */
export function rangePresets(now: Date): RangePreset[] {
  const today = toLocalDateInput(now);
  const month = monthKey(now);
  const threeBack = shiftMonth(month, -3);
  const sameDayThreeBack = `${threeBack}-${String(Math.min(now.getDate(), daysInMonth(threeBack))).padStart(2, '0')}`;
  return [
    { key: 'this-month', label: 'This month', range: monthRange(month) },
    { key: 'last-month', label: 'Last month', range: monthRange(shiftMonth(month, -1)) },
    {
      key: 'last-30-days',
      label: 'Last 30 days',
      range: { from: toLocalDateInput(localDay(today, -29)), to: today },
    },
    {
      key: 'last-3-months',
      label: 'Last 3 months',
      range: { from: toLocalDateInput(localDay(sameDayThreeBack, 1)), to: today },
    },
    {
      key: 'this-year',
      label: 'This year',
      range: { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` },
    },
    { key: 'all-time', label: 'All time', range: null },
  ];
}

/** "1 Oct", with the year only when asked. */
export function shortDay(key: string, withYear = false): string {
  const [year, month, day] = key.split('-');
  const label = `${Number(day)} ${monthShort(`${year}-${month}` as MonthKey)}`;
  return withYear ? `${label} ${year}` : label;
}

/**
 * A range in words: "2026", "Oct 2026", "Mon 14 Sep", the rolling presets by name while they
 * still mean those days, else "1 Oct to 14 Oct", with years once it leaves this year.
 */
export function rangeLabel(range: ActivityRange, now: Date): string {
  const { from, to } = range;
  const year = from.slice(0, 4);
  if (from === `${year}-01-01` && to === `${year}-12-31`) return year;
  const month = from.slice(0, 7) as MonthKey;
  if (sameRange(range, monthRange(month))) return `${monthShort(month)} ${year}`;
  if (from === to) return formatDate(localDay(from), now);
  const rolling = rangePresets(now).find(
    (preset) => preset.key.startsWith('last-') && preset.key !== 'last-month' && sameRange(preset.range, range),
  );
  if (rolling) return rolling.label;
  const thisYear = String(now.getFullYear());
  if (year !== to.slice(0, 4)) return `${shortDay(from, true)} to ${shortDay(to, true)}`;
  return `${shortDay(from)} to ${shortDay(to, year !== thisYear)}`;
}

/** Groups newest-first rows by local day. Day totals leave transfers out. */
export function groupActivityDays(transactions: readonly FinanceTransaction[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const transaction of transactions) {
    const key = toLocalDateInput(new Date(transaction.transactionDate));
    let day = days.at(-1);
    if (day?.key !== key) {
      day = {
        key,
        transactions: [],
        spentMinor: 0 as MinorAmount,
        inMinor: 0 as MinorAmount,
      };
      days.push(day);
    }
    day.transactions.push(transaction);
    if (transaction.type === 'expense')
      day.spentMinor = addMinor(day.spentMinor, transaction.amountMinor);
    else if (transaction.type === 'income')
      day.inMinor = addMinor(day.inMinor, transaction.amountMinor);
  }
  return days;
}
