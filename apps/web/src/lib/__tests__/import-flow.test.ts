import { createCalendar, guessMapping, readGenericTable, type ImportPlan } from '@repo/core';
import { describe, expect, it } from 'vitest';
import { columnLetter, dateOrderHint, importCounts, undoImport, writtenRows } from '../import-flow';

const calendar = createCalendar('Asia/Kuala_Lumpur');
const NOW = '2026-10-14T07:00:00.000Z';

describe('columnLetter', () => {
  it('names columns as a spreadsheet does', () => {
    expect([0, 1, 25, 26, 27].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB']);
  });
});

describe('dateOrderHint', () => {
  it('names the first date that reads both ways', () => {
    const table = readGenericTable('Date,Description,Amount\n05/05/2026,SHELL,-60.00\n03/10/2026,GRAB*FOOD,-32.80\n')!;
    expect(dateOrderHint(table, guessMapping(table.headers), calendar)).toBe('No date is past the 12th, so 03/10 could be 3 Oct or 10 Mar.');
  });

  it('says nothing without a date column', () => {
    const table = readGenericTable('Description,Amount\nSHELL,-60.00\n')!;
    expect(dateOrderHint(table, guessMapping(table.headers), calendar)).toBeNull();
  });
});

const generic: ImportPlan = { kind: 'generic', fresh: [], here: [], problems: [{ line: 4, reason: 'No amount' }], writes: [{}, {}] };

describe('importCounts', () => {
  it('counts a CSV by its rows and a restore by every table', () => {
    expect(importCounts({ ...generic, fresh: [{} as never, {} as never], here: [{} as never] })).toEqual({ fresh: 2, here: 1, problems: 1 });
    const counts = { wallets: { fresh: 1, here: 2 }, categories: { fresh: 0, here: 11 }, budgets: { fresh: 0, here: 0 }, debts: { fresh: 0, here: 0 }, debtActivities: { fresh: 0, here: 0 }, transactions: { fresh: 3, here: 40 } };
    expect(importCounts({ kind: 'restore', counts, problems: [], writes: { wallets: [], categories: [], budgets: [], debts: [], debtActivities: [], transactions: [] }, debtsToRefresh: [] })).toEqual({
      fresh: 4,
      here: 53,
      problems: 0,
    });
  });
});

describe('writtenRows and undoImport', () => {
  it('soft-deletes a CSV’s rows by the ids they were given, last first', () => {
    const rows = writtenRows(generic, ['t-1', 't-2']);
    expect(undoImport(rows, NOW)).toEqual({
      insert: [],
      patch: [],
      softDelete: [
        { table: 'transactions', id: 't-2', at: NOW },
        { table: 'transactions', id: 't-1', at: NOW },
      ],
    });
  });

  it('undoes a restore child tables first', () => {
    const plan: ImportPlan = {
      kind: 'restore',
      counts: {} as never,
      problems: [],
      writes: { wallets: [{ id: 'w-1' }], categories: [], budgets: [{ id: 'b-1' }], debts: [], debtActivities: [], transactions: [{ id: 't-1' }] },
      debtsToRefresh: [],
    };
    expect(undoImport(writtenRows(plan, []), NOW).softDelete).toEqual([
      { table: 'transactions', id: 't-1', at: NOW },
      { table: 'category_budgets', id: 'b-1', at: NOW },
      { table: 'wallets', id: 'w-1', at: NOW },
    ]);
  });
});
