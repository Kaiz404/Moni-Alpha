import {
  budgetNote,
  lastMonthAndAverage,
  type BudgetNote,
  type CategorySpend,
  type FinanceCategory,
  type MoneyMonth,
  type SpendByMonth,
} from '@repo/core';
import type { MinorAmount } from '@repo/types';

/** One line of the Budgets table and the category pane: this month against its budget and its past. */
export type BudgetLine = {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: MinorAmount;
  budgetMinor: MinorAmount | null;
  note: BudgetNote;
  lastMonthMinor: MinorAmount;
  averageMinor: MinorAmount | null;
  /** Spend per month, oldest first, ending with this month. */
  months: MinorAmount[];
};

export type BudgetTable = {
  budgeted: BudgetLine[];
  /** Spent this month with no budget: the table's "No budget yet" rows. */
  unbudgeted: BudgetLine[];
  /** The month's budget: the user's monthly total, else the sum of category budgets. */
  budgetMinor: MinorAmount | null;
  /** The category budgets added up ("RM1,300 of it in categories"). */
  inCategoriesMinor: MinorAmount;
  spentMinor: MinorAmount;
  lastMonthMinor: MinorAmount;
  averageMinor: MinorAmount | null;
};

function line(spend: CategorySpend, month: MoneyMonth, history: SpendByMonth): BudgetLine {
  const months = history.byCategory.get(spend.categoryId) ?? history.months.map(() => 0 as MinorAmount);
  return {
    categoryId: spend.categoryId,
    name: spend.name,
    icon: spend.icon,
    color: spend.color,
    spentMinor: spend.spentMinor,
    budgetMinor: spend.budgetMinor,
    note: budgetNote(spend.spentMinor, spend.budgetMinor, month.currency),
    ...lastMonthAndAverage(history, months),
    months,
  };
}

/**
 * The Budgets table from the money month and the months before it. `everyCategory` lists the
 * categories with neither budget nor spending too, for when the user sets budgets from scratch.
 */
export function budgetTable(
  month: MoneyMonth,
  history: SpendByMonth,
  everyCategory: readonly FinanceCategory[] | null = null,
): BudgetTable {
  const shown = new Set([...month.budgeted, ...month.unbudgeted].map((spend) => spend.categoryId));
  const quiet: CategorySpend[] = (everyCategory ?? [])
    .filter((category) => !shown.has(category.id))
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      spentMinor: 0 as MinorAmount,
      budgetMinor: null,
    }));
  const totals = lastMonthAndAverage(history, history.totals);
  return {
    budgeted: month.budgeted.map((spend) => line(spend, month, history)),
    unbudgeted: [...month.unbudgeted, ...quiet].map((spend) => line(spend, month, history)),
    budgetMinor: month.budgetMinor,
    inCategoriesMinor: month.budgeted.reduce((sum, spend) => sum + Number(spend.budgetMinor ?? 0), 0) as MinorAmount,
    spentMinor: month.spentMinor,
    lastMonthMinor: totals.lastMonthMinor,
    averageMinor: totals.averageMinor,
  };
}

/**
 * A budget typed into a cell, in whole units as the board edits it: "RM1,200" and "1200.90" read
 * 1200. Empty or zero clears the budget (null); anything else unreadable is undefined.
 */
export function parseBudgetDraft(text: string): MinorAmount | null | undefined {
  const cleaned = text.replace(/[\s,]/g, '').replace(/^rm/i, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d*)?$/.test(cleaned)) return undefined;
  const whole = Math.floor(Number(cleaned));
  if (whole > 9_999_999) return undefined;
  return whole === 0 ? null : ((whole * 100) as MinorAmount);
}

/** An amount of money typed in full, cents allowed: "150", "RM1,200.50". Undefined when unreadable or not above zero. */
export function parseAmountDraft(text: string): MinorAmount | undefined {
  const cleaned = text.replace(/[\s,]/g, '').replace(/^rm/i, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return undefined;
  const [whole = '0', cents = ''] = cleaned.split('.');
  const minor = Number(whole) * 100 + Number(cents.padEnd(2, '0'));
  return minor > 0 && minor <= 999_999_999 ? (minor as MinorAmount) : undefined;
}

/** One slice of the spending ring, in degrees clockwise from twelve o'clock. */
export type RingSegment = { key: string; start: number; span: number };

/**
 * The ring's slices: each in proportion to what it spent, except that small ones are widened to
 * `minimum` degrees so their glyph still fits; the rest share what is left.
 */
export function ringSegments(slices: readonly { key: string; spentMinor: number }[], minimum = 25): RingSegment[] {
  const live = slices.filter((slice) => slice.spentMinor > 0);
  const total = live.reduce((sum, slice) => sum + slice.spentMinor, 0);
  if (!total) return [];
  if (live.length * minimum >= 360) {
    return live.map((slice, index) => ({ key: slice.key, start: (index * 360) / live.length, span: 360 / live.length }));
  }
  const raw = live.map((slice) => (slice.spentMinor / total) * 360);
  const small = raw.map((angle) => angle < minimum);
  const bigTotal = raw.reduce((sum, angle, index) => (small[index] ? sum : sum + angle), 0);
  const scale = (360 - minimum * small.filter(Boolean).length) / bigTotal;
  let start = 0;
  return live.map((slice, index) => {
    const span = small[index] ? minimum : raw[index]! * scale;
    const segment = { key: slice.key, start, span };
    start += span;
    return segment;
  });
}

/** The pane's chart: a rounded top for the y axis that leaves room above the tallest bar and the budget. */
export function chartTop(values: readonly number[], budgetMinor: number | null): number {
  const most = Math.max(0, ...values, budgetMinor ?? 0) / 100;
  if (most === 0) return 10_000;
  const step = most <= 200 ? 20 : most <= 600 ? 50 : most <= 2000 ? 100 : 500;
  return Math.ceil((most * 1.18) / step) * step * 100;
}
