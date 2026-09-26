/**
 * Recurring series and payday from the user's own ledger. Pure and deterministic: series only
 * predict, they never post to the ledger. A series is one currency, one type and one merchant.
 */
import type { MinorAmount, RecurringKind, RecurringOverride } from '@repo/types';
import type { FinanceTransaction } from '@/lib/finance/types';
import { merchantKey } from '../routine';
import { addMonths, dayNumber, dayOfMonth } from './days';

export type FactsTransaction = Pick<
  FinanceTransaction,
  | 'walletId'
  | 'transferToWalletId'
  | 'amountMinor'
  | 'currency'
  | 'type'
  | 'analysisExcluded'
  | 'debtActivityId'
  | 'categoryId'
  | 'merchant'
  | 'transactionDate'
>;

export type Cadence = 'weekly' | 'biweekly' | 'monthly';

/** Gap between payments that still counts as the cadence, and days past due before a series ends. */
const CADENCES: Record<Cadence, { min: number; max: number; grace: number }> = {
  weekly: { min: 6, max: 8, grace: 3 },
  biweekly: { min: 12, max: 16, grace: 4 },
  monthly: { min: 27, max: 34, grace: 5 },
};
export const MIN_OCCURRENCES = 3;
/** Amounts within this share of the series median count as the same payment. */
const AMOUNT_BAND = 0.2;
/** Weekly and biweekly spending is only a bill at a fixed price; otherwise it is a habit (groceries). */
const FIXED_PRICE_BAND = 0.02;
/** At or above this confidence a series is trusted without asking the user. */
export const CONFIDENT = 0.8;
const SUBSCRIPTION_CATEGORIES = new Set(['subscriptions', 'entertainment']);

export type RecurringSeries = {
  key: string;
  label: string;
  currency: string;
  type: 'income' | 'expense';
  kind: RecurringKind;
  cadence: Cadence;
  expectedAmountMinor: MinorAmount;
  lastDay: number;
  nextExpectedDay: number;
  occurrences: number;
  confidence: number;
  confirmed: boolean;
  needsConfirm: boolean;
};

export function seriesKey(
  tx: Pick<FactsTransaction, 'currency' | 'type' | 'merchant'>,
): string | null {
  const merchant = merchantKey(tx.merchant);
  if (!merchant || (tx.type !== 'income' && tx.type !== 'expense')) return null;
  return `${tx.currency}|${tx.type}|${merchant}`;
}

/** Ledger rows that are the user's own money moving: no transfers, adjustments or debt mirrors. */
export function isCashFlow(tx: FactsTransaction): boolean {
  return (
    (tx.type === 'income' || tx.type === 'expense') && !tx.analysisExcluded && !tx.debtActivityId
  );
}

function cadenceOf(gap: number): Cadence | null {
  const cadences = Object.keys(CADENCES) as Cadence[];
  return cadences.find((c) => gap >= CADENCES[c].min && gap <= CADENCES[c].max) ?? null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

type Occurrence = { day: number; amountMinor: number; merchant: string; categoryId: string | null };

function detectSeries(
  key: string,
  occurrences: Occurrence[],
  override: RecurringOverride | undefined,
  categoryNames: Record<string, string>,
  today: number,
): RecurringSeries | null {
  if (occurrences.length < MIN_OCCURRENCES) return null;
  const sorted = [...occurrences].sort((a, b) => a.day - b.day);
  const last = sorted[sorted.length - 1];
  const cadence = cadenceOf(last.day - sorted[sorted.length - 2].day);
  if (!cadence) return null;

  const run = [last];
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    if (cadenceOf(sorted[i + 1].day - sorted[i].day) !== cadence) break;
    run.unshift(sorted[i]);
  }
  if (run.length < MIN_OCCURRENCES) return null;

  const [currency, type] = key.split('|') as [string, 'income' | 'expense'];
  const band = type === 'expense' && cadence !== 'monthly' ? FIXED_PRICE_BAND : AMOUNT_BAND;
  const typical = median(run.map((o) => o.amountMinor));
  const inBand = run.filter((o) => Math.abs(o.amountMinor - typical) <= typical * band);
  if (inBand.length < Math.max(MIN_OCCURRENCES, Math.ceil(run.length * 0.75))) return null;

  const expectedDay = override?.expectedDay ?? median(run.slice(-6).map((o) => dayOfMonth(o.day)));
  const nextExpectedDay =
    cadence === 'monthly'
      ? addMonths(last.day, 1, expectedDay)
      : last.day + (cadence === 'weekly' ? 7 : 14);
  if (today > nextExpectedDay + CADENCES[cadence].grace) return null;

  const confirmed = override?.status === 'confirmed';
  const detected = Math.min(0.9, 0.3 + 0.1 * run.length) - (inBand.length < run.length ? 0.1 : 0);
  const confidence = confirmed ? 1 : Math.round(detected * 100) / 100;
  const category = last.categoryId ? categoryNames[last.categoryId]?.toLowerCase() : undefined;

  return {
    key,
    label: last.merchant.trim(),
    currency,
    type,
    kind:
      override?.kind ??
      (type === 'income'
        ? 'income'
        : category && SUBSCRIPTION_CATEGORIES.has(category)
          ? 'subscription'
          : 'bill'),
    cadence,
    expectedAmountMinor: (override?.expectedAmountMinor ??
      median(inBand.slice(-3).map((o) => o.amountMinor))) as MinorAmount,
    lastDay: last.day,
    nextExpectedDay,
    occurrences: run.length,
    confidence,
    confirmed,
    needsConfirm: !confirmed && confidence < CONFIDENT,
  };
}

/**
 * Active series in every currency, newest evidence first. A series needs 3 payments on a
 * weekly, biweekly or monthly cadence at a stable amount, and ends once a payment is missed.
 * Dismissed series are hidden; confirmed ones are fully trusted.
 */
export function detectRecurring(
  transactions: readonly FactsTransaction[],
  overrides: readonly RecurringOverride[],
  now: Date,
  categoryNames: Record<string, string> = {},
): RecurringSeries[] {
  const today = dayNumber(now);
  const byKey = new Map<string, Occurrence[]>();
  for (const tx of transactions) {
    if (!isCashFlow(tx) || new Date(tx.transactionDate) > now) continue;
    const key = seriesKey(tx);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push({
      day: dayNumber(tx.transactionDate),
      amountMinor: Number(tx.amountMinor),
      merchant: tx.merchant ?? '',
      categoryId: tx.categoryId,
    });
    byKey.set(key, list);
  }
  const verdicts = new Map(overrides.map((o) => [o.seriesKey, o]));

  const series: RecurringSeries[] = [];
  for (const [key, occurrences] of byKey) {
    const override = verdicts.get(key);
    if (override?.status === 'dismissed') continue;
    const found = detectSeries(key, occurrences, override, categoryNames, today);
    if (found) series.push(found);
  }
  return series.sort((a, b) => b.lastDay - a.lastDay || a.key.localeCompare(b.key));
}

/** The confirmed income series, else the most trusted monthly one (larger amount breaks ties). */
export function pickPayday(series: readonly RecurringSeries[]): RecurringSeries | null {
  const income = series.filter((s) => s.type === 'income');
  const rank = (list: RecurringSeries[]) =>
    [...list].sort(
      (a, b) => b.confidence - a.confidence || b.expectedAmountMinor - a.expectedAmountMinor,
    )[0] ?? null;
  return (
    rank(income.filter((s) => s.confirmed)) ?? rank(income.filter((s) => s.cadence === 'monthly'))
  );
}

/** Expected payment days from the next one (possibly already past due) up to `beforeDay`. */
export function seriesDates(series: RecurringSeries, beforeDay: number): number[] {
  const days: number[] = [];
  const dom = dayOfMonth(series.nextExpectedDay);
  let day = series.nextExpectedDay;
  for (let step = 1; day < beforeDay; step += 1) {
    days.push(day);
    day =
      series.cadence === 'monthly'
        ? addMonths(series.nextExpectedDay, step, dom)
        : series.nextExpectedDay + step * (series.cadence === 'weekly' ? 7 : 14);
  }
  return days;
}
