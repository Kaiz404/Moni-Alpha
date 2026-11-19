import type { Calendar, DayKey, Instant, MonthKey } from '../calendar';
import { dayOfMonth, dayKeyOf, daysInMonth, monthOf } from '../calendar';
import { monthShort } from '../glossary';
import { countsAsSpending, type LedgerTransaction } from '../ledger';
import { pickAnswerCard, type AnswerCard, type AnswerSnapshot } from './answer-cards';

/**
 * The web's answer card for spending (W2-Chat's "FOOD & DINING BY WEEK"): the month so far in weeks of
 * seven days from the 1st, against the even pace for a week. The phone draws the same answer as its
 * pace chart, so `pickAnswerCard` is unchanged; this only lays the ledger out by week.
 */
export type WeekBar = { label: string; from: DayKey; to: DayKey; spentMinor: number };

export type WeekSpend = {
  weeks: WeekBar[];
  /** The budget's even pace for seven days, whole ringgit rounded down; null without a budget. */
  paceMinor: number | null;
};

export type WeekSpendInput = {
  transactions: readonly (LedgerTransaction & {
    currency: string;
    categoryId: string | null;
    amountMinor: number | bigint;
    transactionDate: Instant;
  })[];
  currency: string;
  /** One category, or null for all spending. */
  categoryId: string | null;
  /** Null without a budget. */
  budgetMinor: number | null;
  today: DayKey;
  calendar: Calendar;
};

export function spendByWeek({ transactions, currency, categoryId, budgetMinor, today, calendar }: WeekSpendInput): WeekSpend {
  const month: MonthKey = monthOf(today);
  const [year, monthNumber] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const last = dayOfMonth(today);
  const weeks: WeekBar[] = [];
  for (let start = 1; start <= last; start += 7) {
    const end = Math.min(start + 6, last);
    weeks.push({
      label: `${start}–${end} ${monthShort(month)}`,
      from: dayKeyOf(year, monthNumber, start),
      to: dayKeyOf(year, monthNumber, end),
      spentMinor: 0,
    });
  }
  for (const transaction of transactions) {
    if (!countsAsSpending(transaction) || transaction.currency !== currency) continue;
    if (categoryId !== null && transaction.categoryId !== categoryId) continue;
    const day = calendar.dayKey(transaction.transactionDate);
    if (monthOf(day) !== month || day > today) continue;
    weeks[Math.floor((dayOfMonth(day) - 1) / 7)]!.spentMinor += Number(transaction.amountMinor);
  }
  const pace = budgetMinor === null ? null : (budgetMinor * 7) / daysInMonth(month);
  return { weeks, paceMinor: pace === null ? null : Math.floor(pace / 100) * 100 };
}

const SPEND_WORDS = /\b(spen[dt]|spending|high|much|so far|this month|this week|left|budget)\b/i;

/**
 * The card a question asked from a view gets: `pickAnswerCard`'s, except that a spending question
 * naming no category, asked while the view shows one ("Why so high this month?" on Activity filtered
 * to Food), gets that category's card.
 */
export function pickViewAnswerCard(question: string, snapshot: AnswerSnapshot, viewCategoryId: string | null): AnswerCard | null {
  const picked = pickAnswerCard(question, snapshot);
  if (!viewCategoryId || (picked && picked.kind !== 'budget_progress') || !SPEND_WORDS.test(question)) return picked;
  const category = snapshot.categories.find((each) => each.id === viewCategoryId);
  return { kind: 'category_spend', categoryId: viewCategoryId, spent: category?.spent ?? 0, budget: category?.budget ?? null };
}
