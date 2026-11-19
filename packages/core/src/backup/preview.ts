import type { DayKey } from '../calendar';
import { dayLabel } from '../glossary';
import { merchantName } from '../read-model/merchants';
import { readImportRows, type ColumnMapping, type DateOrder, type GenericTable } from './generic-csv';
import { planGeneric, type GenericTarget, type StoreSnapshot } from './plan';

/** How Moni reads one row of a CSV under the current column choices. */
export type PreviewRead =
  | {
      kind: 'row';
      day: DayKey;
      /** "Today", "Yesterday" or "Wed 14 Oct", as a list shows the day. */
      dateLabel: string;
      /** After the user's merchant names. */
      merchant: string | null;
      type: 'expense' | 'income';
      /** Negative for money out. */
      signedMinor: number;
      /** Whether Moni already holds it; null until a wallet is chosen. */
      status: 'new' | 'here' | null;
    }
  | { kind: 'problem'; reason: string };

/** One row of the file beside how Moni reads it, for a preview that redraws on every column change. */
export type PreviewRow = { line: number; cells: readonly string[]; read: PreviewRead };

export type PreviewContext = Omit<GenericTarget, 'wallet'> & {
  store: StoreSnapshot;
  wallet: GenericTarget['wallet'] | null;
  today: DayKey;
};

/**
 * The first `limit` rows of the file as Moni would import them. Rows are read and matched against
 * the whole file, as the import itself does, so a direction or a second identical payment further
 * down reads the same here as it will on Check the file.
 */
export function previewRows(
  table: GenericTable,
  mapping: ColumnMapping,
  order: DateOrder,
  limit: number,
  context: PreviewContext,
): PreviewRow[] {
  const { rows, problems } = readImportRows(table, mapping, order, context.calendar);
  const plan = context.wallet
    ? planGeneric(rows, problems, context.store, { ...context, wallet: context.wallet })
    : null;
  const status = new Map<number, 'new' | 'here'>([
    ...(plan?.fresh ?? []).map((row) => [row.line, 'new'] as const),
    ...(plan?.here ?? []).map((row) => [row.line, 'here'] as const),
  ]);
  const reasons = new Map<number, string>();
  for (const problem of plan?.problems ?? problems) {
    if (!reasons.has(problem.line)) reasons.set(problem.line, problem.reason);
  }
  const read = new Map(rows.map((row) => [row.line, row]));

  return table.rows.slice(0, limit).map(({ line, cells }): PreviewRow => {
    const reason = reasons.get(line);
    const row = read.get(line);
    if (reason !== undefined || !row) return { line, cells, read: { kind: 'problem', reason: reason ?? '' } };
    return {
      line,
      cells,
      read: {
        kind: 'row',
        day: row.day,
        dateLabel: dayLabel(row.day, context.today),
        merchant: merchantName(row.merchant, context.aliases),
        type: row.type,
        signedMinor: row.type === 'expense' ? -row.amountMinor : row.amountMinor,
        status: status.get(line) ?? null,
      },
    };
  });
}
