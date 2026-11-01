import { parseLocalDateInput } from '@/lib/dates/local-date-input';

import { parseCsv, type CsvRow } from './csv';
import type { RowProblem } from './read-moni-export';

export type DateOrder = 'dmy' | 'mdy';

export const MAPPED_FIELDS = [
  'date',
  'amount',
  'moneyOut',
  'moneyIn',
  'merchant',
  'category',
  'note',
  'type',
  'currency',
] as const;
export type MappedField = (typeof MAPPED_FIELDS)[number];

/** Which column of the file holds each field, by index; null when the file has none. */
export type ColumnMapping = Record<MappedField, number | null>;

export type GenericTable = {
  headers: string[];
  rows: CsvRow[];
  brokenLines: number[];
};

/** One readable row of a generic CSV, not yet matched against what Moni holds. */
export type ImportRow = {
  line: number;
  /** Local `YYYY-MM-DD`. */
  day: string;
  at: string;
  type: 'expense' | 'income';
  amountMinor: number;
  merchant: string | null;
  note: string | null;
  categoryName: string | null;
  currency: string | null;
};

const DAY_MS = 86_400_000;
/** English and Malay weekdays in front of a date. */
const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun|isn|sel|rab|kha|jum|sab|aha)[a-z]*,?\s+(?=\d)/i;
/** A mark after an amount, with or without a space: `45.90 DR`, `45.90CR`. */
const DR_CR = /(^|[^a-z])(dr|cr)\.?$/i;
const MERCHANT_MAX = 200;
const NOTE_MAX = 1000;
/** NUMERIC(12,2) holds up to ten digits before the point. */
const MAX_MINOR = 999_999_999_999;

const WORDS: Record<MappedField, RegExp> = {
  date: /^(transaction |posting |value |trans\.? |booking )?date$|^date\b|^tarikh\b|^when$|^time$/,
  amount: /^(transaction )?(amount|amt|total)\b|^value$|^jumlah\b|^amaun\b/,
  moneyOut: /^(money out|debit|debit amount|withdrawals?|withdrawal amount|paid out|out|keluar|pengeluaran)\b/,
  moneyIn: /^(money in|credit|credit amount|deposits?|deposit amount|paid in|in|masuk|kredit)\b/,
  merchant: /^(merchant|payee|shop|store|vendor|name|description|details?|particulars?|narrative|keterangan|perkara|butiran|nama)\b/,
  category: /^(category|kategori)\b/,
  note: /^(notes?|memo|remarks?|nota|catatan|reference|ref)\b/,
  type: /^(type|direction|jenis)\b/,
  currency: /^(currency|ccy|matawang|mata wang)\b/,
};

/**
 * A statement often has lines above its table. The heading is the first row as wide as most of
 * the rows after it.
 */
export function readGenericTable(text: string): GenericTable | null {
  const { rows, brokenLines } = parseCsv(text);
  if (rows.length === 0) return null;
  const filled = (row: CsvRow) => row.cells.filter((cell) => cell.trim() !== '').length;
  const widths = new Map<number, number>();
  for (const row of rows.slice(0, 50)) widths.set(filled(row), (widths.get(filled(row)) ?? 0) + 1);
  const usual = [...widths.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const start = rows.findIndex((row) => filled(row) >= Math.max(2, usual));
  if (start < 0) return null;
  return {
    headers: rows[start].cells.map((cell) => cell.trim()),
    rows: rows.slice(start + 1),
    brokenLines,
  };
}

/** The first column whose heading reads like each field; a column serves one field. */
export function guessMapping(headers: readonly string[]): ColumnMapping {
  const mapping = Object.fromEntries(MAPPED_FIELDS.map((field) => [field, null])) as ColumnMapping;
  const taken = new Set<number>();
  for (const field of MAPPED_FIELDS) {
    const at = headers.findIndex(
      (header, index) => !taken.has(index) && WORDS[field].test(header.trim().toLowerCase()),
    );
    if (at >= 0) {
      mapping[field] = at;
      taken.add(at);
    }
  }
  return mapping;
}

export function mappingIsComplete(mapping: ColumnMapping): boolean {
  return (
    mapping.date !== null &&
    (mapping.amount !== null || mapping.moneyOut !== null || mapping.moneyIn !== null)
  );
}

const pad = (value: number) => String(value).padStart(2, '0');

function fullYear(text: string): number {
  const year = Number(text);
  return text.length <= 2 ? 2000 + year : year;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mac: 3,
  mar: 3,
  apr: 4,
  may: 5,
  mei: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ogo: 8,
  sep: 9,
  oct: 10,
  okt: 10,
  nov: 11,
  dec: 12,
  dis: 12,
};

type ParsedDate = { day: string; at: string };

function build(year: number, month: number, date: number, rest: string): ParsedDate | null {
  const day = `${year}-${pad(month)}-${pad(date)}`;
  const midnight = parseLocalDateInput(day);
  if (!midnight) return null;
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i.exec(rest);
  if (!time) return { day, at: midnight.toISOString() };
  let hours = Number(time[1]);
  const meridiem = time[4]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23 || Number(time[2]) > 59) return null;
  midnight.setHours(hours, Number(time[2]), Number(time[3] ?? 0));
  return { day, at: midnight.toISOString() };
}

/** Reads the date formats banks and apps write, day first unless `order` says otherwise. */
export function parseImportDate(cell: string, order: DateOrder): ParsedDate | null {
  const text = cell.trim().replace(WEEKDAY, '');
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}[T ].*(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const time = Date.parse(text.replace(' ', 'T'));
    if (Number.isNaN(time)) return null;
    const date = new Date(time);
    return {
      day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      at: date.toISOString(),
    };
  }
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/.exec(text);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), iso[4]);

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?!\d)(.*)$/.exec(text);
  if (numeric) {
    const [first, second] = [Number(numeric[1]), Number(numeric[2])];
    return order === 'dmy'
      ? build(fullYear(numeric[3]), second, first, numeric[4])
      : build(fullYear(numeric[3]), first, second, numeric[4]);
  }

  const named = /^(\d{1,2})[-\s/]([a-z]{3,9})[-\s/,]+(\d{2}|\d{4})(?!\d)(.*)$/i.exec(text);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    return month ? build(fullYear(named[3]), month, Number(named[1]), named[4]) : null;
  }
  const monthFirst = /^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(.*)$/i.exec(text);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    return month ? build(Number(monthFirst[3]), month, Number(monthFirst[2]), monthFirst[4]) : null;
  }
  // An Excel date saved as its serial number: days since 30 Dec 1899.
  if (/^\d{5}$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(text) * DAY_MS);
    return build(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), '');
  }
  return null;
}

/**
 * Whether `01/02/2026` means 1 Feb or 2 Jan. One date past the 12th settles it for the column;
 * with none, it stays day first, as Malaysia writes dates, and the user can change it.
 */
export function guessDateOrder(cells: readonly string[]): { order: DateOrder; settled: boolean } {
  let dayFirst = false;
  let monthFirst = false;
  for (const cell of cells) {
    const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(cell.trim());
    if (!numeric) continue;
    if (Number(numeric[1]) > 12) dayFirst = true;
    if (Number(numeric[2]) > 12) monthFirst = true;
  }
  if (dayFirst) return { order: 'dmy', settled: true };
  if (monthFirst) return { order: 'mdy', settled: true };
  return {
    order: 'dmy',
    settled: !cells.some((cell) => /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(cell.trim())),
  };
}

export type ParsedAmount = { minor: number; negative: boolean; mark: 'out' | 'in' | null };

/**
 * Reads what statements write: `RM1,116.20`, `-45.90`, `(45.90)`, `45.90-`, U+2212, `45.90 DR`,
 * `1.234,56`, `45,90`. A separator followed by three digits groups thousands; followed by one or
 * two, it is the decimal point.
 */
export function parseImportAmount(cell: string): ParsedAmount | null {
  let text = cell.trim().replace(/−/g, '-');
  if (!text) return null;
  const mark = DR_CR.exec(text)?.[2]?.toLowerCase();
  text = text.replace(DR_CR, '$1').trim();
  const negative = /^\(.*\)$/.test(text) || /^[^\d]*-/.test(text) || /-\s*$/.test(text);
  text = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  const point = Math.max(lastDot, lastComma);
  let whole = text;
  let fraction = '';
  if (point >= 0) {
    const tail = text.slice(point + 1);
    const both = lastDot >= 0 && lastComma >= 0;
    const separator = text[point];
    const repeated = text.indexOf(separator) !== point;
    if (both || (tail.length <= 2 && !repeated)) {
      whole = text.slice(0, point);
      fraction = tail;
    } else if (tail.length !== 3) {
      return null;
    }
  }
  const digits = whole.replace(/[.,]/g, '');
  if (fraction.length > 2 || !/^\d*$/.test(digits) || !/^\d*$/.test(fraction)) return null;
  const minor = Number(digits || '0') * 100 + Number(fraction.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(minor)) return null;
  return { minor, negative, mark: mark === 'dr' ? 'out' : mark === 'cr' ? 'in' : null };
}

const cellAt = (row: CsvRow, column: number | null) =>
  column === null ? '' : (row.cells[column] ?? '').trim();

const INCOME_WORD = /^(income|credit|cr|in|deposit|kredit|masuk|money in|refund)\b/i;
const EXPENSE_WORD = /^(expense|debit|dr|out|withdrawal|payment|keluar|purchase|money out|spending)\b/i;
const TRANSFER_WORD = /^(transfer|pindahan)\b/i;

type Direction = 'expense' | 'income' | 'transfer' | null;

function directionOf(row: CsvRow, mapping: ColumnMapping): Direction {
  const word = cellAt(row, mapping.type);
  if (TRANSFER_WORD.test(word)) return 'transfer';
  if (INCOME_WORD.test(word)) return 'income';
  if (EXPENSE_WORD.test(word)) return 'expense';
  return null;
}

/**
 * Turns the file's rows into import rows, or says why a row can't be read. Direction comes from the
 * Type column, then Money out or Money in, then a DR or CR mark, then the sign; a column with no
 * negative amount at all is a list of spending.
 */
export function readImportRows(
  table: GenericTable,
  mapping: ColumnMapping,
  order: DateOrder,
): { rows: ImportRow[]; problems: RowProblem[] } {
  const problems: RowProblem[] = table.brokenLines.map((line) => ({
    line,
    reason: 'A quote never closes',
  }));
  const rows: ImportRow[] = [];
  const signed = table.rows.some((row) => {
    const amount = parseImportAmount(cellAt(row, mapping.amount));
    return amount !== null && (amount.negative || amount.mark !== null);
  });

  for (const row of table.rows) {
    const fail = (reason: string) => problems.push({ line: row.line, reason });
    const date = parseImportDate(cellAt(row, mapping.date), order);
    if (!date) {
      fail("The date can't be read");
      continue;
    }
    const declared = directionOf(row, mapping);
    if (declared === 'transfer') {
      fail('A transfer needs two wallets, so it stays out');
      continue;
    }
    const out = parseImportAmount(cellAt(row, mapping.moneyOut));
    const inward = parseImportAmount(cellAt(row, mapping.moneyIn));
    const single = parseImportAmount(cellAt(row, mapping.amount));
    const amount = out?.minor ? out : inward?.minor ? inward : single;
    if (!amount) {
      fail("The amount can't be read");
      continue;
    }
    if (amount.minor === 0) {
      fail('The amount is zero');
      continue;
    }
    if (amount.minor > MAX_MINOR) {
      fail('The amount is too large');
      continue;
    }
    const type =
      declared ??
      (out?.minor
        ? 'expense'
        : inward?.minor
          ? 'income'
          : amount.mark === 'out' || amount.negative
            ? 'expense'
            : amount.mark === 'in' || signed
              ? 'income'
              : 'expense');
    rows.push({
      line: row.line,
      day: date.day,
      at: date.at,
      type,
      amountMinor: amount.minor,
      merchant: cellAt(row, mapping.merchant).slice(0, MERCHANT_MAX) || null,
      note: cellAt(row, mapping.note).slice(0, NOTE_MAX) || null,
      categoryName: cellAt(row, mapping.category) || null,
      currency: cellAt(row, mapping.currency).toUpperCase() || null,
    });
  }
  return { rows, problems };
}
