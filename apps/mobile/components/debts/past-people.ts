import type { DebtLine, DebtSide } from '@/lib/finance/debt-summary';

export const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Everyone on one side of a past debt, settled ones too, most recent first and each name once. */
export function pastPeople(lines: readonly DebtLine[], side: DebtSide): string[] {
  const names: string[] = [];
  const newestFirst = lines
    .filter((line) => line.debt.direction === side)
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  for (const { debt } of newestFirst)
    if (!names.some((known) => sameName(known, debt.counterpartyName)))
      names.push(debt.counterpartyName);
  return names;
}
