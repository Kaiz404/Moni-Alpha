/** Device-local calendar days as integers, so day arithmetic ignores DST and odd UTC offsets. */
export function dayNumber(value: Date | string): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

/** YYYY-MM-DD for a day number. */
export function dayKey(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Day `dayOfMonth` of the month `months` after the one holding `day`, clamped to its length. */
export function addMonths(day: number, months: number, dayOfMonth: number): number {
  const date = new Date(day * 86_400_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(dayOfMonth, length)) / 86_400_000;
}

/** First day of the month after the one holding `day`. */
export function nextMonthStart(day: number): number {
  return addMonths(day, 1, 1);
}

export function dayOfMonth(day: number): number {
  return new Date(day * 86_400_000).getUTCDate();
}

/** Local midnight at the start of a day number. */
export function dayStart(day: number): Date {
  const date = new Date(day * 86_400_000);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
