import {
  addMinor,
  subtractMinor,
  type CurrencyCode,
  type MinorAmount,
} from '@repo/types';

import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import type { FinanceDebt, FinanceDebtActivity } from './types';

export type DebtSide = FinanceDebt['direction'];
export type DebtState = 'open' | 'settled' | 'written_off';

type Activity = Pick<
  FinanceDebtActivity,
  'id' | 'debtId' | 'kind' | 'amountMinor' | 'activityDate'
>;

/** One debt with the money that moved on it: what every debts screen reads. */
export type DebtLine = {
  debt: FinanceDebt;
  principalMinor: MinorAmount;
  repaidMinor: MinorAmount;
  balanceMinor: MinorAmount;
  state: DebtState;
  /** ISO time of the first principal ("Lent Sun 27 Sep"). */
  startedAt: string;
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
export function describeDebt(
  debt: FinanceDebt,
  activities: readonly Activity[],
): DebtLine | null {
  const own = activities
    .filter((activity) => activity.debtId === debt.id)
    .sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  const of = (kind: Activity['kind']) =>
    sum(
      own
        .filter((activity) => activity.kind === kind)
        .map((activity) => activity.amountMinor),
    );
  const first = own.find((activity) => activity.kind === 'principal');
  if (!first) return null;
  const principalMinor = of('principal');
  const repaidMinor = of('repayment');
  const writtenOffMinor = of('write_off');
  const balanceMinor = subtractMinor(
    principalMinor,
    addMinor(repaidMinor, writtenOffMinor),
  );
  const state: DebtState =
    balanceMinor > 0 ? 'open' : writtenOffMinor > 0 ? 'written_off' : 'settled';
  return {
    debt,
    principalMinor,
    repaidMinor,
    balanceMinor,
    state,
    startedAt: first.activityDate,
    lastAt: own[own.length - 1]?.activityDate ?? first.activityDate,
  };
}

/** Whole local days from `now` to a local `YYYY-MM-DD`. */
export function daysUntil(dueDate: string, now: Date): number | null {
  const due = parseLocalDateInput(dueDate);
  if (!due) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function byDueThenName(a: DebtLine, b: DebtLine): number {
  const due = (line: DebtLine) => line.debt.dueDate ?? '9999-12-31';
  return (
    due(a).localeCompare(due(b)) ||
    a.debt.counterpartyName.localeCompare(b.debt.counterpartyName)
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
): DebtSummary {
  const lines = debts
    .filter((debt) => debt.currency === currency)
    .map((debt) => describeDebt(debt, activities))
    .filter((line): line is DebtLine => line !== null);
  const open = lines.filter((line) => line.state === 'open').sort(byDueThenName);
  const total = (side: DebtSide) =>
    sum(
      open
        .filter((line) => line.debt.direction === side)
        .map((line) => line.balanceMinor),
    );
  const owedToMeMinor = total('owed_to_me');
  const iOweMinor = total('i_owe');
  const comingUp = open.flatMap((line): ComingUpRow[] => {
    const dueDate = line.debt.dueDate;
    const daysLeft = dueDate ? daysUntil(dueDate, now) : null;
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
