import { addMinor, subtractMinor, type CurrencyCode, type MinorAmount } from '@repo/types';

import { addMonths, type Calendar, type DayKey, dayOfMonth, daysBetween, parseDayKey } from '../calendar';
import { debtStatus, type DebtStatus, debtTotals } from '../ledger';
import type { FinanceDebt, FinanceDebtActivity } from './types';

export type DebtSide = FinanceDebt['direction'];

type Activity = Pick<
  FinanceDebtActivity,
  'id' | 'debtId' | 'kind' | 'amountMinor' | 'activityDate'
> &
  Partial<Pick<FinanceDebtActivity, 'walletId'>>;

/** One debt with the money that moved on it: what every debts screen reads. */
export type DebtLine = {
  debt: FinanceDebt;
  principalMinor: MinorAmount;
  repaidMinor: MinorAmount;
  balanceMinor: MinorAmount;
  state: DebtStatus;
  /** ISO time of the first principal ("Lent Sun 27 Sep"). */
  startedAt: string;
  /** The first principal moved no money: a record only ("Noted Thu 1 Oct"). */
  noted: boolean;
  /** ISO time of the newest activity; closed debts sort by it. */
  lastAt: string;
};

export type ComingUpRow = {
  line: DebtLine;
  dueDate: string;
  /** Whole local days from today; negative once late. */
  daysLeft: number;
};

export type DebtSummary = {
  currency: CurrencyCode;
  owedToMeMinor: MinorAmount;
  iOweMinor: MinorAmount;
  /** Owed to me minus I owe. */
  netMinor: MinorAmount;
  open: DebtLine[];
  comingUp: ComingUpRow[];
  closed: DebtLine[];
};

const sum = (amounts: MinorAmount[]) => addMinor(0, ...amounts);

/** Null until the debt's first principal has arrived (a half-synced debt shows nowhere). */
export function describeDebt(debt: FinanceDebt, activities: readonly Activity[]): DebtLine | null {
  const own = activities
    .filter((activity) => activity.debtId === debt.id)
    .sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  const first = own.find((activity) => activity.kind === 'principal');
  if (!first) return null;
  const { principalMinor, repaidMinor, balanceMinor } = debtTotals(own);
  return {
    debt,
    principalMinor,
    repaidMinor,
    balanceMinor,
    state: debtStatus(own),
    startedAt: first.activityDate,
    noted: first.walletId === null,
    lastAt: own[own.length - 1]?.activityDate ?? first.activityDate,
  };
}

/** Whole local days from `now` to a local `YYYY-MM-DD`. */
export function daysUntil(dueDate: string, now: Date, calendar: Calendar): number | null {
  const due = parseDayKey(dueDate);
  return due ? daysBetween(calendar.dayKey(now), due) : null;
}

/** The last day a due date can be set to: a year from today. The first is today. */
export function lastDueDate(today: DayKey): DayKey {
  return addMonths(today, 12, dayOfMonth(today));
}

function byDueThenName(a: DebtLine, b: DebtLine): number {
  const due = (line: DebtLine) => line.debt.dueDate ?? '9999-12-31';
  return (
    due(a).localeCompare(due(b)) || a.debt.counterpartyName.localeCompare(b.debt.counterpartyName)
  );
}

/**
 * The Debts tab in one pass, in the main currency only: debts in any other
 * currency appear nowhere here and never add to a total.
 */
export function summarizeDebts(
  debts: readonly FinanceDebt[],
  activities: readonly Activity[],
  now: Date,
  currency: CurrencyCode,
  calendar: Calendar,
): DebtSummary {
  const lines = debts
    .filter((debt) => debt.currency === currency)
    .map((debt) => describeDebt(debt, activities))
    .filter((line): line is DebtLine => line !== null);
  const open = lines.filter((line) => line.state === 'open').sort(byDueThenName);
  const total = (side: DebtSide) =>
    sum(open.filter((line) => line.debt.direction === side).map((line) => line.balanceMinor));
  const owedToMeMinor = total('owed_to_me');
  const iOweMinor = total('i_owe');
  const comingUp = open.flatMap((line): ComingUpRow[] => {
    const dueDate = line.debt.dueDate;
    const daysLeft = dueDate ? daysUntil(dueDate, now, calendar) : null;
    return dueDate && daysLeft !== null ? [{ line, dueDate, daysLeft }] : [];
  });
  return {
    currency,
    owedToMeMinor,
    iOweMinor,
    netMinor: subtractMinor(owedToMeMinor, iOweMinor),
    open,
    comingUp,
    closed: lines
      .filter((line) => line.state !== 'open')
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
  };
}

/** The Debts list's two status choices: still open, or settled and written off. */
export type DebtStatusChoice = 'open' | 'closed';
export const DEBT_SIDES = ['owed_to_me', 'i_owe'] as const satisfies readonly DebtSide[];
export const DEBT_STATUS_CHOICES = ['open', 'closed'] as const satisfies readonly DebtStatusChoice[];

/** What the Debts list shows. An empty list shows every choice, as Activity's wallet filter does. */
export type DebtFilter = { sides: readonly DebtSide[]; statuses: readonly DebtStatusChoice[] };

/** The ticked choices in their own order, an empty list read as every one. */
export function tickedChoices<T extends string>(picked: readonly T[], every: readonly T[]): T[] {
  return picked.length === 0 ? [...every] : every.filter((choice) => picked.includes(choice));
}

/** The list under the filters, open debts first, and Coming up on the same sides. */
export function filterDebts(
  summary: Pick<DebtSummary, 'open' | 'closed' | 'comingUp'>,
  filter: DebtFilter,
): { lines: DebtLine[]; comingUp: ComingUpRow[] } {
  const sides = tickedChoices(filter.sides, DEBT_SIDES);
  const statuses = tickedChoices(filter.statuses, DEBT_STATUS_CHOICES);
  const onSide = (line: DebtLine) => sides.includes(line.debt.direction);
  return {
    lines: [
      ...(statuses.includes('open') ? summary.open : []),
      ...(statuses.includes('closed') ? summary.closed : []),
    ].filter(onSide),
    comingUp: summary.comingUp.filter((row) => onSide(row.line)),
  };
}
