import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import type { DebtDue, LeftThisMonth } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';

/** Home's words for a BudgetMonth; the numbers come from buildBudgetMonth (D1). */

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

/** "today", "tomorrow", or "on Fri 16 Oct" for a local YYYY-MM-DD. */
export function dueWhen(dueDate: string, now: Date): string {
  const due = parseLocalDateInput(dueDate);
  if (!due) return `on ${dueDate}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${formatDate(due, now)}`;
}
