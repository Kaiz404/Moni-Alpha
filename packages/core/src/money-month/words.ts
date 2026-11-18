/**
 * The money month's sentences. The numbers come from `buildMoneyMonth` (D1); each screen words
 * the edges its own way, and these are the only copies:
 *
 * - Budget (`budgetLine`, `leftSentence`) names bills and debts: "RM443 left for 18 days after
 *   bills and RM40 to Mei · RM24 a day". It keeps "· RM0 a day" when nothing is safe to spend, and
 *   over budget it keeps what was set aside: "RM20 over after bills and RM40 to Mei".
 * - Home (`homeLine`) names only debts, and only when no bills strip carries them: "RM443 left
 *   for 18 days after RM40 to Mei · RM24 a day". At RM0 a day it drops the per-day part, and over
 *   budget it says only "RM20 over". New transaction (`leftLine`) reads the same, naming nothing.
 * - Review (`reviewSafeToSpend`) says "RM420 left for 18 days after these." under the per-day
 *   change its approvals made.
 */
import type { MinorAmount } from '@repo/types';

import { formatMoney } from '../glossary';
import type { DebtDue, LeftThisMonth, MoneyMonth } from './month';
import { safePerDayAfter } from './pace';

/** "RM40 to Mei", or "RM60 to 2 people". */
export function debtPhrase(debtsDue: readonly DebtDue[], currency: string): string | null {
  if (!debtsDue.length) return null;
  const total = debtsDue.reduce((sum, debt) => sum + Number(debt.amountMinor), 0);
  const amount = formatMoney(total, currency, { whole: true });
  return debtsDue.length === 1
    ? `${amount} to ${debtsDue[0]!.name}`
    : `${amount} to ${debtsDue.length} people`;
}

/** "RM443 left for 18 days · RM24 a day", or "RM20 over". `after` names what else came off it. */
export function leftLine(left: LeftThisMonth, currency: string, after?: string | null): string {
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  if (left.leftMinor < 0) return `${whole(-left.leftMinor)} over`;
  const days = `${left.daysLeft} ${left.daysLeft === 1 ? 'day' : 'days'}${after ? ` after ${after}` : ''}`;
  return left.perDayMinor > 0
    ? `${whole(left.leftMinor)} left for ${days} · ${whole(left.perDayMinor)} a day`
    : `${whole(left.leftMinor)} left for ${days}`;
}

/** "after bills and RM40 to Mei", or null when nothing is set aside. */
export function setAsideLabel(left: LeftThisMonth, currency: string): string | null {
  const parts: string[] = [];
  if (left.billsMinor > 0) parts.push('bills');
  const debts = debtPhrase(left.debtsDue, currency);
  if (debts) parts.push(debts);
  return parts.length ? `after ${parts.join(' and ')}` : null;
}

/** The line under "Spent in October": what is left, after what, and safe to spend a day. */
export function leftSentence(
  month: Pick<MoneyMonth, 'budgetMinor' | 'spentMinor' | 'currency' | 'left'>,
): string | null {
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

/**
 * Review's safe to spend a day before and after this session's approvals (`addedMinor` of
 * spending): RM24, an arrow, RM23 over "RM420 left for 18 days after these.". `before` is null
 * when the approvals did not move it; the whole is null without a budget or anything left.
 */
export function reviewSafeToSpend(
  month: Pick<MoneyMonth, 'currency' | 'left'>,
  addedMinor: number,
): { before: string | null; after: string; sentence: string } | null {
  const { left, currency } = month;
  if (!left || left.leftMinor <= 0) return null;
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  const before = safePerDayAfter(left, -addedMinor);
  const days = `${left.daysLeft} ${left.daysLeft === 1 ? 'day' : 'days'}`;
  return {
    before: before === left.perDayMinor ? null : whole(before),
    after: whole(left.perDayMinor),
    sentence: `${whole(left.leftMinor)} left for ${days}${addedMinor > 0 ? ' after these' : ''}.`,
  };
}

export type BudgetNote = {
  label: string;
  /** `near` is 75% or more of the budget; `quiet` is a category with nothing spent and no budget. */
  tone: 'plain' | 'near' | 'over' | 'quiet';
  /** Spent ÷ budget clamped to 1, or null when there is no budget to draw a bar for. */
  ratio: number | null;
};

const NEAR_LIMIT = 0.75;

/** The one progress label from tokens.md: "RM100 left", "RM20 over", else what was spent. */
export function budgetNote(
  spentMinor: MinorAmount,
  budgetMinor: MinorAmount | null,
  currency: string,
): BudgetNote {
  if (budgetMinor == null || budgetMinor <= 0) {
    return spentMinor > 0
      ? { label: `${formatMoney(spentMinor, currency)} spent`, tone: 'plain', ratio: null }
      : { label: 'Nothing yet', tone: 'quiet', ratio: null };
  }
  const left = budgetMinor - spentMinor;
  if (left < 0) {
    return {
      label: `${formatMoney(-left, currency, { whole: true })} over`,
      tone: 'over',
      ratio: 1,
    };
  }
  const ratio = spentMinor / budgetMinor;
  return {
    label: `${formatMoney(left, currency, { whole: true })} left`,
    tone: ratio >= NEAR_LIMIT ? 'near' : 'plain',
    ratio,
  };
}
