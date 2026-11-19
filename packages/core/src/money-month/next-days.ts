import { addMinor, type MinorAmount, type UpcomingBill } from '@repo/types';

import { addDays, daysBetween, type DayKey } from '../calendar';
import { dateLabel } from '../glossary';
import type { ComingUpRow } from '../read-model/debt-summary';

export type NextDayItem = {
  key: string;
  day: DayKey;
  /** Whole days from today, 0 to the window's length. */
  offset: number;
  /** "Tomorrow", else "Tue 20 Oct". */
  when: string;
  /** The bill's name, "To Mei" for money the user owes, "From Ali" for money owed to them. */
  name: string;
  amountMinor: MinorAmount;
  kind: 'bill' | 'owe' | 'owed';
  categoryId: string | null;
};

export type NextDays = {
  items: NextDayItem[];
  /** Bills and money the user owes in the window: "RM240.80, set aside". */
  setAsideMinor: MinorAmount;
  days: number;
};

/**
 * Home's "Next 14 days": bills still due and open debts with a due date inside the window, in date
 * order. A day already past (a late bill or debt) is left to Budget and Debts.
 */
export function nextDays({
  bills,
  comingUp,
  today,
  currency,
  days = 14,
}: {
  bills: readonly UpcomingBill[];
  comingUp: readonly ComingUpRow[];
  today: DayKey;
  currency: string;
  days?: number;
}): NextDays {
  const inside = (day: DayKey) => {
    const offset = daysBetween(today, day);
    return offset >= 0 && offset <= days ? offset : null;
  };
  const when = (day: DayKey) => (day === addDays(today, 1) ? 'Tomorrow' : day === today ? 'Today' : dateLabel(day, today));
  const items: NextDayItem[] = [];
  for (const bill of bills) {
    const offset = bill.currency === currency && bill.status === 'due' ? inside(bill.dueDate) : null;
    if (offset === null) continue;
    items.push({
      key: `bill:${bill.seriesKey}:${bill.dueDate}`,
      day: bill.dueDate,
      offset,
      when: when(bill.dueDate),
      name: bill.name,
      amountMinor: bill.amountMinor,
      kind: 'bill',
      categoryId: bill.categoryId,
    });
  }
  for (const row of comingUp) {
    const offset = row.line.debt.currency === currency ? inside(row.dueDate) : null;
    if (offset === null) continue;
    const owe = row.line.debt.direction === 'i_owe';
    items.push({
      key: `debt:${row.line.debt.id}`,
      day: row.dueDate,
      offset,
      when: when(row.dueDate),
      name: `${owe ? 'To' : 'From'} ${row.line.debt.counterpartyName}`,
      amountMinor: row.line.balanceMinor,
      kind: owe ? 'owe' : 'owed',
      categoryId: null,
    });
  }
  items.sort((a, b) => a.day.localeCompare(b.day) || a.name.localeCompare(b.name));
  return {
    items,
    setAsideMinor: addMinor(0, ...items.filter((item) => item.kind !== 'owed').map((item) => item.amountMinor)),
    days,
  };
}
