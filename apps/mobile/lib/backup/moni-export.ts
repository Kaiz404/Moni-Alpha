import { decimalToMinor, minorToDecimal } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';

import { textCell, valueCell } from './csv';

export type RawRow = Record<string, unknown>;

export type TableName =
  | 'wallets'
  | 'categories'
  | 'budgets'
  | 'debts'
  | 'debtActivities'
  | 'transactions';

/** The store's rows, one list per table, in the snake_case Postgres and Legend-State share. */
export type BackupTables = Record<TableName, RawRow[]>;

/** Parents before the rows that point at them, the order a restore writes in. */
export const TABLE_ORDER: readonly TableName[] = [
  'wallets',
  'categories',
  'budgets',
  'debts',
  'debtActivities',
  'transactions',
];

export const EXPORT_MARKER = 'Moni export';
export const EXPORT_VERSION = 1;

type Names = { wallets: Map<string, string>; categories: Map<string, string>; debts: Map<string, string> };

export type ColumnKind = 'text' | 'money' | 'bool' | 'number' | 'json';

export type Column = {
  header: string;
  /** The store column this restores. A column without one is only there for people reading the file. */
  field?: string;
  kind?: ColumnKind;
  show?: (row: RawRow, names: Names) => string | null | undefined;
};

const text = (header: string, field: string): Column => ({ header, field });
const of = (kind: ColumnKind) => (header: string, field: string): Column => ({ header, field, kind });
const money = of('money');
const bool = of('bool');
const number = of('number');

const nameIn = (names: Map<string, string>, id: unknown) =>
  typeof id === 'string' ? names.get(id) : undefined;

function metadataOf(row: RawRow): Record<string, unknown> {
  const raw = row.metadata;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Section title in the file, and the columns of each table. */
export const TABLES: Record<TableName, { title: string; columns: Column[] }> = {
  wallets: {
    title: 'Wallets',
    columns: [
      text('Id', 'id'),
      text('Name', 'name'),
      text('Type', 'type'),
      text('Currency', 'currency'),
      money('Opening balance', 'initial_balance'),
      text('Color', 'color'),
      text('Icon', 'icon'),
      text('Card style', 'card_style_id'),
      bool('Active', 'is_active'),
      number('Order', 'display_order'),
      text('Banking app', 'notification_package'),
      text('Banking app name', 'notification_app_label'),
      text('Account hint', 'notification_account_hint'),
      text('Balance confirmed', 'balance_confirmed_at'),
      bool('Record location', 'record_location'),
    ],
  },
  categories: {
    title: 'Categories',
    columns: [
      text('Id', 'id'),
      text('Name', 'name'),
      text('Type', 'type'),
      text('Icon', 'icon'),
      text('Color', 'color'),
      bool('Active', 'is_active'),
      number('Order', 'display_order'),
      { header: 'Yours', field: 'yours', show: (row) => (row.user_id ? 'yes' : 'no') },
    ],
  },
  budgets: {
    title: 'Budgets',
    columns: [
      text('Id', 'id'),
      { header: 'Category', show: (row, names) => nameIn(names.categories, row.category_id) },
      text('Category id', 'category_id'),
      text('Currency', 'currency'),
      money('Amount', 'amount'),
    ],
  },
  debts: {
    title: 'Debts',
    columns: [
      text('Id', 'id'),
      text('Person', 'counterparty_name'),
      text('Direction', 'direction'),
      text('Currency', 'currency'),
      text('Due date', 'due_date'),
      text('Note', 'note'),
      text('Status', 'status'),
    ],
  },
  debtActivities: {
    title: 'Debt activity',
    columns: [
      text('Id', 'id'),
      { header: 'Person', show: (row, names) => nameIn(names.debts, row.debt_id) },
      text('Debt id', 'debt_id'),
      text('Kind', 'kind'),
      money('Amount', 'amount'),
      text('Date', 'activity_date'),
      { header: 'Wallet', show: (row, names) => nameIn(names.wallets, row.wallet_id) },
      text('Wallet id', 'wallet_id'),
      text('Cash transaction id', 'cash_transaction_id'),
      text('Note', 'note'),
    ],
  },
  transactions: {
    title: 'Transactions',
    columns: [
      text('Id', 'id'),
      {
        header: 'Date',
        show: (row) => {
          const date = new Date(String(row.transaction_date));
          return Number.isNaN(date.getTime()) ? null : toLocalDateInput(date);
        },
      },
      text('Timestamp', 'transaction_date'),
      text('Type', 'type'),
      money('Amount', 'amount'),
      text('Currency', 'currency'),
      text('Merchant', 'merchant'),
      text('Description', 'description'),
      { header: 'Category', show: (row, names) => nameIn(names.categories, row.category_id) },
      text('Category id', 'category_id'),
      { header: 'Wallet', show: (row, names) => nameIn(names.wallets, row.wallet_id) },
      text('Wallet id', 'wallet_id'),
      { header: 'To wallet', show: (row, names) => nameIn(names.wallets, row.transfer_to_wallet_id) },
      text('To wallet id', 'transfer_to_wallet_id'),
      text('Note', 'notes'),
      {
        header: 'Source',
        show: (row) => {
          const source = metadataOf(row).source;
          return typeof source === 'string' ? source : 'manual';
        },
      },
      text('Place', 'location_name'),
      number('Latitude', 'location_latitude'),
      number('Longitude', 'location_longitude'),
      bool('Not counted', 'analysis_excluded'),
      text('Debt activity id', 'debt_activity_id'),
      text('Linked id', 'linked_transaction_id'),
      text('Receipt', 'receipt_image_url'),
      { header: 'Metadata', field: 'metadata', kind: 'json' },
    ],
  },
};

function plain(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function cellFor(column: Column, row: RawRow, names: Names): string {
  if (column.show) return textCell(column.show(row, names));
  const value = row[column.field!];
  switch (column.kind) {
    case 'money':
      return valueCell(minorToDecimal(decimalToMinor(plain(value))));
    case 'bool':
      return value === null || value === undefined ? '' : value === true || value === 1 ? 'yes' : 'no';
    case 'number':
      return valueCell(plain(value));
    case 'json':
      return valueCell(JSON.stringify(metadataOf(row)));
    default:
      return textCell(plain(value));
  }
}

const byId = (rows: readonly RawRow[], nameField: string) =>
  new Map(rows.map((row) => [String(row.id), plain(row[nameField])]));

export function exportFileName(now: Date): string {
  return `moni-${toLocalDateInput(now)}.csv`;
}

/**
 * One UTF-8 file of titled sections, each with its own header row, and native currencies only.
 * The first line names the format and the account, so a restore can check both. Transactions run
 * oldest first. The byte order mark tells Excel the file is UTF-8.
 */
export function buildMoniExport(tables: BackupTables, account: string, now: Date): string {
  const names: Names = {
    wallets: byId(tables.wallets, 'name'),
    categories: byId(tables.categories, 'name'),
    debts: byId(tables.debts, 'counterparty_name'),
  };
  const sorted: BackupTables = {
    ...tables,
    transactions: [...tables.transactions].sort((a, b) =>
      plain(a.transaction_date).localeCompare(plain(b.transaction_date)),
    ),
  };
  const lines = [[EXPORT_MARKER, String(EXPORT_VERSION), account, now.toISOString()].join(',')];
  for (const table of TABLE_ORDER) {
    const { title, columns } = TABLES[table];
    lines.push('', title, columns.map((column) => column.header).join(','));
    for (const row of sorted[table]) {
      lines.push(columns.map((column) => cellFor(column, row, names)).join(','));
    }
  }
  return `﻿${lines.join('\n')}\n`;
}
