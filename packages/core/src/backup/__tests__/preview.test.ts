import { describe, expect, it } from 'vitest';

import { createCalendar } from '../../calendar';
import { guessMapping, readGenericTable, type GenericTable } from '../generic-csv';
import type { StoreSnapshot } from '../plan';
import { previewRows, type PreviewContext } from '../preview';

const KL = createCalendar('Asia/Kuala_Lumpur');
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WALLET = { id: '11111111-1111-4111-8111-111111111111', currency: 'MYR' };

const EMPTY: StoreSnapshot = {
  wallets: [],
  categories: [],
  budgets: [],
  debts: [],
  debtActivities: [],
  transactions: [],
};

const context: PreviewContext = {
  userId: USER,
  aliases: [{ rawKey: 'tng ewallet', displayName: 'Touch n Go' }],
  calendar: KL,
  store: EMPTY,
  wallet: null,
  today: '2026-10-15',
};

const table = (csv: string): GenericTable => readGenericTable(csv)!;
const preview = (csv: string, limit: number, overrides: Partial<PreviewContext> = {}) => {
  const file = table(csv);
  return previewRows(file, guessMapping(file.headers), 'dmy', limit, { ...context, ...overrides });
};

describe('previewRows', () => {
  it('shows each row beside how Moni reads it, before a wallet is chosen', () => {
    expect(
      preview('Date,Merchant,Amount\n14/10/2026,TNG EWALLET,-12.50\n12/10/2026,Salary,4200\nsomeday,Kedai,-1\n', 10),
    ).toEqual([
      {
        line: 2,
        cells: ['14/10/2026', 'TNG EWALLET', '-12.50'],
        read: {
          kind: 'row',
          day: '2026-10-14',
          dateLabel: 'Yesterday',
          merchant: 'Touch n Go',
          type: 'expense',
          signedMinor: -1250,
          status: null,
        },
      },
      {
        line: 3,
        cells: ['12/10/2026', 'Salary', '4200'],
        read: {
          kind: 'row',
          day: '2026-10-12',
          dateLabel: 'Mon 12 Oct',
          merchant: 'Salary',
          type: 'income',
          signedMinor: 420000,
          status: null,
        },
      },
      { line: 4, cells: ['someday', 'Kedai', '-1'], read: { kind: 'problem', reason: "The date can't be read" } },
    ]);
  });

  it('reads the first rows as the whole file reads them: a negative further down makes a positive one income', () => {
    const rows = preview('Date,Merchant,Amount\n12/10/2026,Salary,4200\n14/10/2026,Grab,-12.00\n', 1);
    expect(rows.map((row) => row.line)).toEqual([2]);
    expect(rows[0]!.read).toMatchObject({ type: 'income', signedMinor: 420000 });
  });

  it('says which rows are new and which Moni already holds, once a wallet is chosen', () => {
    const held: StoreSnapshot = {
      ...EMPTY,
      transactions: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          user_id: USER,
          merchant: 'Grab A-98QZ',
          amount: '12.00',
          currency: 'MYR',
          type: 'expense',
          transaction_date: '2026-10-14T11:30:00.000Z',
        },
      ],
    };
    const rows = preview(
      'Date,Merchant,Amount,Currency\n14/10/2026,GRAB*1234 KL,-12.00,MYR\n14/10/2026,Grab,-12.00,MYR\n14/10/2026,Kopi,-3.00,USD\n',
      10,
      { store: held, wallet: WALLET },
    );
    expect(rows.map(({ line, read }) => [line, read.kind === 'row' ? read.status : read.reason])).toEqual([
      [2, 'here'],
      [3, 'new'],
      [4, 'In USD, and this wallet is in MYR'],
    ]);
  });
});
