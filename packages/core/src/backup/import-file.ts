import { decodeFile } from './decode';
import {
  guessDateOrder,
  guessMapping,
  readGenericTable,
  readImportRows,
  type ColumnMapping,
  type DateOrder,
  type GenericTable,
} from './generic-csv';
import { planGeneric, planRestore, type GenericTarget, type ImportPlan, type StoreSnapshot } from './plan';
import { readMoniExport, type MoniFile } from './read-moni-export';

export type GenericChoices = {
  mapping: ColumnMapping;
  order: DateOrder;
  /** Whether the file itself shows which way round its dates are. */
  orderSettled: boolean;
  wallet: { id: string; currency: string } | null;
};

/** A chosen file between Import data's steps: a Moni export to restore, or a CSV to match columns for. */
export type ImportSession =
  | { kind: 'restore'; fileName: string; file: MoniFile }
  | { kind: 'generic'; fileName: string; table: GenericTable; choices: GenericChoices };

export type ReadFile = { kind: 'ok'; session: ImportSession } | { kind: 'problem'; reason: string };

const MAX_BYTES = 20 * 1024 * 1024;

/** Sorts a file into a restore, a CSV to map with its guessed columns and date order, or the reason it is neither. */
export function readImportFile(fileName: string, bytes: Uint8Array, userId: string): ReadFile {
  if (bytes.length > MAX_BYTES) return { kind: 'problem', reason: 'This file is over 20 MB.' };
  const decoded = decodeFile(bytes);
  if (decoded.kind === 'workbook') {
    return {
      kind: 'problem',
      reason: "That's an Excel workbook. Save it as a CSV, then choose it again.",
    };
  }
  if (decoded.kind === 'binary') return { kind: 'problem', reason: "That isn't a CSV file." };

  const moni = readMoniExport(decoded.text);
  if (moni.kind === 'newer') {
    return { kind: 'problem', reason: 'This export is from a newer Moni. Update Moni, then try again.' };
  }
  if (moni.kind === 'moni') {
    // Its ids belong to that account's rows, which this account can never write to.
    return moni.file.account === userId
      ? { kind: 'ok', session: { kind: 'restore', fileName, file: moni.file } }
      : {
          kind: 'problem',
          reason: 'This export is from another Moni account. Sign in to that account to restore it.',
        };
  }

  const table = readGenericTable(decoded.text);
  if (!table || table.rows.length === 0) {
    return { kind: 'problem', reason: 'This file has no rows to read.' };
  }
  const mapping = guessMapping(table.headers);
  const dates = mapping.date === null ? [] : table.rows.map((row) => row.cells[mapping.date!] ?? '');
  const { order, settled } = guessDateOrder(dates);
  return {
    kind: 'ok',
    session: {
      kind: 'generic',
      fileName,
      table,
      choices: { mapping, order, orderSettled: settled, wallet: null },
    },
  };
}

/**
 * What the file would do to the store as it stands. Plan again right before writing, so a sync or a
 * double tap in between can only shrink what is written. A CSV has no plan until it has a wallet.
 */
export function planImport(
  session: ImportSession,
  store: StoreSnapshot,
  target: Omit<GenericTarget, 'wallet'>,
): ImportPlan | null {
  if (session.kind === 'restore') return planRestore(session.file, store, target.userId);
  const { mapping, order, wallet } = session.choices;
  if (!wallet) return null;
  const { rows, problems } = readImportRows(session.table, mapping, order, target.calendar);
  return planGeneric(rows, problems, store, { ...target, wallet });
}
