import {
  parseImportDate,
  restoreTotals,
  shortDate,
  STORE_TABLE_NAMES,
  TABLE_ORDER,
  type Calendar,
  type ColumnMapping,
  type GenericTable,
  type ImportPlan,
  type MappedField,
  type RowWrites,
  type SyncedTable,
} from '@repo/core';

/** Import data's three steps (W2-Data's stepper). A Moni export skips Match columns. */
export type ImportStep = 'choose' | 'match' | 'check';

/** The spreadsheet letter of a column: A, B, … Z, AA. */
export function columnLetter(index: number): string {
  let letter = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  return letter;
}

/** The pickers W2-Data draws, then the rest a statement may need, shown once mapped or asked for. */
export const BOARD_FIELDS: readonly { field: MappedField; label: string }[] = [
  { field: 'date', label: 'Date' },
  { field: 'merchant', label: 'Merchant' },
  { field: 'amount', label: 'Amount' },
  { field: 'category', label: 'Category' },
];

export const MORE_FIELDS: readonly { field: MappedField; label: string }[] = [
  { field: 'moneyOut', label: 'Money out' },
  { field: 'moneyIn', label: 'Money in' },
  { field: 'note', label: 'Note' },
  { field: 'type', label: 'Type' },
  { field: 'currency', label: 'Currency' },
];

/** "New", "already here" and unreadable rows a plan holds; a restore counts every table's rows. */
export function importCounts(plan: ImportPlan): { fresh: number; here: number; problems: number } {
  const { fresh, here } = plan.kind === 'restore' ? restoreTotals(plan) : { fresh: plan.fresh.length, here: plan.here.length };
  return { fresh, here, problems: plan.problems.length };
}

/**
 * Why Day first | Month first shows: the first date that reads both ways, as both. Null when every
 * date settles it, or no date column is chosen.
 */
export function dateOrderHint(table: GenericTable, mapping: ColumnMapping, calendar: Calendar): string | null {
  if (mapping.date === null) return null;
  for (const row of table.rows) {
    const cell = (row.cells[mapping.date] ?? '').trim();
    const numeric = /^(\d{1,2})([-/.])(\d{1,2})\2\d{2,4}/.exec(cell);
    if (!numeric || numeric[1] === numeric[3]) continue;
    const dayFirst = parseImportDate(cell, 'dmy', calendar);
    const monthFirst = parseImportDate(cell, 'mdy', calendar);
    if (!dayFirst || !monthFirst) continue;
    const written = `${numeric[1]}${numeric[2]}${numeric[3]}`;
    return `No date is past the 12th, so ${written} could be ${shortDate(dayFirst.day)} or ${shortDate(monthFirst.day)}.`;
  }
  return null;
}

/** A row an import wrote, by the synced table it went to. */
export type WrittenRow = { table: SyncedTable; id: string };

/** The rows a plan writes: a restore's own ids, or the ids `applyPlan` gave a CSV's rows, in order. */
export function writtenRows(plan: ImportPlan, csvIds: readonly string[]): WrittenRow[] {
  if (plan.kind === 'generic') return csvIds.map((id) => ({ table: 'transactions', id }));
  return TABLE_ORDER.flatMap((table) => plan.writes[table].map((row) => ({ table: STORE_TABLE_NAMES[table], id: String(row.id) })));
}

/** Undo for an import: soft-delete exactly the rows it added, children before parents. */
export function undoImport(rows: readonly WrittenRow[], now: string): RowWrites {
  return { insert: [], patch: [], softDelete: [...rows].reverse().map(({ table, id }) => ({ table, id, at: now })) };
}
