import { decimalToMinor, minorToDecimal } from '@repo/types';
import { z } from 'zod';

import { parseCsv, readTextCell, type CsvRow } from './csv';
import {
  EXPORT_MARKER,
  EXPORT_VERSION,
  TABLES,
  TABLE_ORDER,
  type Column,
  type RawRow,
  type TableName,
} from './moni-export';

/** A row Moni could not take, with where it is so the user can find it. */
export type RowProblem = { line: number; reason: string };

export type MoniFileRow = { line: number; fields: RawRow };

export type MoniFile = {
  account: string;
  rows: Record<TableName, MoniFileRow[]>;
  problems: RowProblem[];
};

export type MoniFileRead =
  | { kind: 'moni'; file: MoniFile }
  /** Written by a later version of Moni than this one. */
  | { kind: 'newer' }
  | { kind: 'other' };

const uuid = z.string().uuid();
const optionalText = z.string().nullable().optional();
const optionalUuid = uuid.nullable().optional();
const currency = z.string().regex(/^[A-Z]{3}$/);
const signedMoney = z.string().regex(/^-?\d{1,10}\.\d{2}$/);
const positiveMoney = signedMoney.refine((value) => Number(value) > 0);
const instant = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const flag = z.boolean().nullable().optional();
const order = z.number().nullable().optional();

const walletSchema = z.object({
  id: uuid,
  name: z.string().min(1),
  type: z.string().min(1),
  currency,
  initial_balance: signedMoney,
  is_active: flag,
  display_order: order,
});

const categorySchema = z.object({
  id: uuid,
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  yours: z.enum(['yes', 'no']),
  is_active: flag,
  display_order: order,
});

const budgetSchema = z.object({
  id: uuid,
  category_id: uuid,
  currency,
  amount: positiveMoney,
});

const debtSchema = z.object({
  id: uuid,
  counterparty_name: z.string().trim().min(1),
  direction: z.enum(['owed_to_me', 'i_owe']),
  currency,
  status: z.enum(['open', 'settled', 'written_off']),
});

const debtActivitySchema = z
  .object({
    id: uuid,
    debt_id: uuid,
    kind: z.enum(['principal', 'repayment', 'write_off']),
    amount: positiveMoney,
    activity_date: instant,
    wallet_id: optionalUuid,
    cash_transaction_id: optionalUuid,
    note: optionalText,
  })
  // The table's own check: a write-off moves no cash, and anything else always does.
  .refine(
    (row) =>
      row.kind === 'write_off'
        ? !row.wallet_id && !row.cash_transaction_id
        : Boolean(row.wallet_id && row.cash_transaction_id),
    { path: ['wallet_id'] },
  );

const transactionSchema = z
  .object({
    id: uuid,
    type: z.enum(['income', 'expense', 'transfer']),
    amount: positiveMoney,
    currency,
    transaction_date: instant,
    category_id: optionalUuid,
    wallet_id: uuid,
    transfer_to_wallet_id: optionalUuid,
    debt_activity_id: optionalUuid,
    location_latitude: z.number().min(-90).max(90).nullable().optional(),
    location_longitude: z.number().min(-180).max(180).nullable().optional(),
    place_id: optionalText,
    place_coords_at: instant.nullable().optional(),
  })
  .refine((row) => row.type !== 'transfer' || Boolean(row.transfer_to_wallet_id), {
    path: ['transfer_to_wallet_id'],
  });

const SCHEMAS: Record<TableName, z.ZodTypeAny> = {
  wallets: walletSchema,
  categories: categorySchema,
  budgets: budgetSchema,
  debts: debtSchema,
  debtActivities: debtActivitySchema,
  transactions: transactionSchema,
};

function castCell(cell: string, column: Column): unknown {
  switch (column.kind) {
    case 'money': {
      if (cell.trim() === '') return null;
      try {
        return minorToDecimal(decimalToMinor(cell));
      } catch {
        return cell;
      }
    }
    case 'bool': {
      const word = cell.trim().toLowerCase();
      if (word === 'yes' || word === 'true' || word === '1') return true;
      if (word === 'no' || word === 'false' || word === '0') return false;
      return null;
    }
    case 'number': {
      if (cell.trim() === '') return null;
      const value = Number(cell);
      return Number.isNaN(value) ? cell : value;
    }
    case 'instant': {
      const text = readTextCell(cell).trim();
      if (text === '') return null;
      const at = new Date(text);
      return Number.isNaN(at.getTime()) ? text : at.toISOString();
    }
    case 'json':
      try {
        const value: unknown = JSON.parse(cell);
        return value && typeof value === 'object' ? value : {};
      } catch {
        return {};
      }
    default: {
      const text = readTextCell(cell);
      return text === '' ? null : text;
    }
  }
}

function readRow(
  table: TableName,
  header: string[],
  row: CsvRow,
): { fields: RawRow } | { problem: string } {
  const extra = row.cells.slice(header.length);
  if (extra.some((cell) => cell.trim() !== '')) return { problem: 'More cells than its heading' };
  const fields: RawRow = {};
  const columns = TABLES[table].columns;
  for (const column of columns) {
    if (!column.field) continue;
    const at = header.indexOf(column.header);
    fields[column.field] = at < 0 ? null : castCell(row.cells[at] ?? '', column);
  }
  const parsed = SCHEMAS[table].safeParse(fields);
  if (parsed.success) return { fields };
  const path = parsed.error.issues[0]?.path[0];
  const column = columns.find((item) => item.field === path);
  return { problem: `${column?.header ?? 'A cell'} can't be read` };
}

/** Reads a file as a Moni export: one line naming it, then a titled section per table. */
export function readMoniExport(text: string): MoniFileRead {
  const { rows, brokenLines } = parseCsv(text);
  const first = rows[0];
  if (first?.cells[0]?.trim() !== EXPORT_MARKER) return { kind: 'other' };
  if (Number(first.cells[1]) > EXPORT_VERSION) return { kind: 'newer' };

  const titles = new Map(TABLE_ORDER.map((table) => [TABLES[table].title, table]));
  const isTitle = (row: CsvRow) =>
    row.cells.slice(1).every((cell) => cell.trim() === '') && titles.has(row.cells[0].trim());

  const file: MoniFile = {
    account: first.cells[2]?.trim() ?? '',
    rows: {
      wallets: [],
      categories: [],
      budgets: [],
      debts: [],
      debtActivities: [],
      transactions: [],
    },
    problems: brokenLines.map((line) => ({ line, reason: 'A quote never closes' })),
  };
  let table: TableName | null = null;
  let header: string[] | null = null;
  for (const row of rows.slice(1)) {
    if (isTitle(row)) {
      table = titles.get(row.cells[0].trim())!;
      header = null;
    } else if (table && !header) {
      header = row.cells.map((cell) => cell.trim());
    } else if (table && header) {
      const read = readRow(table, header, row);
      if ('problem' in read) file.problems.push({ line: row.line, reason: read.problem });
      else file.rows[table].push({ line: row.line, fields: read.fields });
    }
  }
  return { kind: 'moni', file };
}
