import { File } from 'expo-file-system';

import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';

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
import { planGeneric, planRestore, type ImportPlan } from './plan';
import { readMoniExport, type MoniFile } from './read-moni-export';
import { readStoreSnapshot } from './store-tables';

export type GenericChoices = {
  mapping: ColumnMapping;
  order: DateOrder;
  /** Whether the file itself shows which way round its dates are. */
  orderSettled: boolean;
  wallet: { id: string; currency: string } | null;
};

/** The file between its pages. Too large for route params, and worth nothing once the import ends. */
export type ImportSession =
  | { kind: 'restore'; fileName: string; file: MoniFile }
  | { kind: 'generic'; fileName: string; table: GenericTable; choices: GenericChoices };

let session: ImportSession | null = null;

export const getImportSession = () => session;
export const setImportSession = (next: ImportSession | null) => {
  session = next;
};

const MAX_BYTES = 20 * 1024 * 1024;

export type ReadFile = { kind: 'ok'; session: ImportSession } | { kind: 'problem'; reason: string };

/** Sorts a file into a restore, a CSV to map, or the reason it is neither. */
export function readPickedFile(fileName: string, bytes: Uint8Array, userId: string): ReadFile {
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

/** Opens Android's file picker; null when the user backs out. */
export async function pickFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return null;
  return { name: picked.result.name, bytes: await picked.result.bytes() };
}

/**
 * What the file would do to the store as it stands now. The preview calls this to show the counts,
 * and the write calls it again, so a sync or a double tap in between can only shrink what is written.
 */
export function planImport(current: ImportSession, userId: string): ImportPlan | null {
  const store = readStoreSnapshot();
  if (current.kind === 'restore') return planRestore(current.file, store, userId);
  const { mapping, order, wallet } = current.choices;
  if (!wallet) return null;
  const { rows, problems } = readImportRows(current.table, mapping, order);
  return planGeneric(rows, problems, store, {
    userId,
    wallet,
    aliases: listMerchantAliases(userId),
  });
}
