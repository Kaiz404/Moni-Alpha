import type { MinorAmount } from '@repo/types';

import { daysInMonth, type MonthKey } from '../calendar';
import type { LeftThisMonth } from './month';

/** The budget spread evenly over the month, floored to a minor unit. */
export function evenPace(budgetMinor: number, month: MonthKey): MinorAmount {
  return Math.floor(budgetMinor / daysInMonth(month)) as MinorAmount;
}

/** How many of the days spent at or under even pace. */
export function daysAtOrUnderPace(values: ArrayLike<number>, evenPaceMinor: number): number {
  let count = 0;
  for (let day = 0; day < values.length; day++) if (values[day]! <= evenPaceMinor) count++;
  return count;
}

/** Whole money a day for what is left over the days left; 0 once nothing is left. */
export function safePerDay(leftMinor: number, daysLeft: number): MinorAmount {
  return (leftMinor > 0 ? Math.floor(leftMinor / daysLeft / 100) * 100 : 0) as MinorAmount;
}

/** Safe to spend a day had `moreMinor` more been spent; a negative amount undoes spending. */
export function safePerDayAfter(
  left: Pick<LeftThisMonth, 'leftMinor' | 'daysLeft'>,
  moreMinor: number,
): MinorAmount {
  return safePerDay(left.leftMinor - moreMinor, left.daysLeft);
}
