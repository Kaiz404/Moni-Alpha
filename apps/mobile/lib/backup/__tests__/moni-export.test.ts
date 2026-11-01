import { parseCsv, readTextCell, textCell, valueCell, detectDelimiter } from '@/lib/backup/csv';
import { buildMoniExport, exportFileName, type BackupTables } from '@/lib/backup/moni-export';

const WALLET = '11111111-1111-4111-8111-111111111111';
const FOOD = '22222222-2222-4222-8222-222222222222';
const TXN = '33333333-3333-4333-8333-333333333333';

const EMPTY: BackupTables = {
  wallets: [],
  categories: [],
  budgets: [],
  debts: [],
  debtActivities: [],
  transactions: [],
};

const NOW = new Date(Date.UTC(2026, 9, 14, 6, 0));

function section(csv: string, title: string): string[] {
  const lines = csv.split('\n');
  const start = lines.indexOf(title);
  const end = lines.indexOf('', start);
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

describe('buildMoniExport', () => {
  it('starts with a byte order mark and a line naming the format and account', () => {
    const csv = buildMoniExport(EMPTY, 'kai', NOW);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\n')[0]).toBe('Moni export,1,kai,2026-10-14T06:00:00.000Z');
  });

  it('writes a transaction with its id, wallet, category, merchant, note, currency and source', () => {
    const csv = buildMoniExport(
      {
        ...EMPTY,
        wallets: [{ id: WALLET, name: 'Wise', currency: 'USD', initial_balance: 10 }],
        categories: [{ id: FOOD, name: 'Food & Dining', user_id: null }],
        transactions: [
          {
            id: TXN,
            type: 'expense',
            amount: '12.5',
            currency: 'USD',
            merchant: 'Grab, KL',
            description: 'Lunch',
            category_id: FOOD,
            wallet_id: WALLET,
            notes: 'said "lunch"',
            transaction_date: '2026-10-14T04:00:00.000Z',
            metadata: { source: 'notification', alert: { text: 'RM12.50 at GRAB' } },
          },
        ],
      },
      'kai',
      NOW,
    );
    const [header, row] = parseCsv(csv.slice(1).split('Transactions\n')[1]).rows;
    const cell = (name: string) => row.cells[header.cells.indexOf(name)];
    expect(cell('Id')).toBe(TXN);
    expect(cell('Timestamp')).toBe('2026-10-14T04:00:00.000Z');
    expect(cell('Amount')).toBe('12.50');
    expect(cell('Currency')).toBe('USD');
    expect(cell('Merchant')).toBe('Grab, KL');
    expect(cell('Description')).toBe('Lunch');
    expect(cell('Category')).toBe('Food & Dining');
    expect(cell('Category id')).toBe(FOOD);
    expect(cell('Wallet')).toBe('Wise');
    expect(cell('Wallet id')).toBe(WALLET);
    expect(cell('Note')).toBe('said "lunch"');
    expect(cell('Source')).toBe('notification');
    expect(JSON.parse(cell('Metadata'))).toEqual({
      source: 'notification',
      alert: { text: 'RM12.50 at GRAB' },
    });
  });

  it('reads a row with no source as manual, and sorts oldest first', () => {
    const csv = buildMoniExport(
      {
        ...EMPTY,
        transactions: [
          { id: 'b', type: 'income', amount: 1, transaction_date: '2026-10-14T00:00:00.000Z' },
          { id: 'a', type: 'income', amount: 1, transaction_date: '2026-10-13T00:00:00.000Z' },
        ],
      },
      'kai',
      NOW,
    );
    const [header, first, second] = section(csv, 'Transactions').map((line) => line.split(','));
    expect(first[0]).toBe('a');
    expect(second[0]).toBe('b');
    expect(first[header.indexOf('Source')]).toBe('manual');
  });

  it('keeps a negative opening balance a number, and never converts a currency', () => {
    const csv = buildMoniExport(
      { ...EMPTY, wallets: [{ id: WALLET, name: 'Wise', currency: 'USD', initial_balance: -120 }] },
      'kai',
      NOW,
    );
    expect(section(csv, 'Wallets')[1].split(',').slice(0, 5)).toEqual([
      WALLET,
      'Wise',
      '',
      'USD',
      '-120.00',
    ]);
  });

  it('holds every table in its own section, and debts with their activity', () => {
    const csv = buildMoniExport(
      {
        ...EMPTY,
        categories: [{ id: FOOD, name: 'Yoga', user_id: 'kai', type: 'expense' }],
        budgets: [{ id: 'b1', category_id: FOOD, currency: 'MYR', amount: 200 }],
        debts: [{ id: 'd1', counterparty_name: 'Mei', direction: 'i_owe', currency: 'MYR', status: 'open' }],
        debtActivities: [{ id: 'a1', debt_id: 'd1', kind: 'principal', amount: 40, activity_date: '2026-10-01' }],
      },
      'kai',
      NOW,
    );
    expect(section(csv, 'Budgets')).toEqual(['Id,Category,Category id,Currency,Amount', `b1,Yoga,${FOOD},MYR,200.00`]);
    expect(section(csv, 'Debts')[1]).toBe('d1,Mei,i_owe,MYR,,,open');
    expect(section(csv, 'Debt activity')[1]).toBe('a1,Mei,d1,principal,40.00,2026-10-01,,,,');
    expect(section(csv, 'Categories')[1].split(',').at(-1)).toBe('yes');
  });

  it('names the file for the local day', () => {
    expect(exportFileName(new Date(2026, 9, 14, 14, 6))).toBe('moni-2026-10-14.csv');
  });
});

describe('text cells', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(valueCell('Grab, KL')).toBe('"Grab, KL"');
    expect(valueCell('said "hi"')).toBe('"said ""hi"""');
    expect(valueCell('two\nlines')).toBe('"two\nlines"');
    expect(valueCell(null)).toBe('');
  });

  it("stops a spreadsheet running a cell, and gets the value back exactly", () => {
    for (const value of ['=HYPERLINK("x")', '+60123', '-5', '@sum', "'=already", "''+two", "it's"]) {
      const { rows } = parseCsv(`${textCell(value)},x\n`);
      expect(rows[0].cells[0].startsWith("'") || !/^[=+\-@]/.test(value)).toBe(true);
      expect(readTextCell(rows[0].cells[0])).toBe(value);
    }
  });
});

describe('parseCsv', () => {
  const cells = (text: string) => parseCsv(text).rows.map((row) => row.cells);

  it('reads quotes, doubled quotes, and line breaks inside quotes', () => {
    expect(cells('a,"b,c","d ""e"" f"\n"g\nh",i,j\n')).toEqual([
      ['a', 'b,c', 'd "e" f'],
      ['g\nh', 'i', 'j'],
    ]);
  });

  it('counts lines across a quoted line break', () => {
    expect(parseCsv('a,"b\nc"\nd,e\n').rows.map((row) => row.line)).toEqual([1, 3]);
  });

  it('reads Windows and old Mac line endings, and a last line with no ending', () => {
    expect(cells('a,b\r\nc,d\re,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ]);
  });

  it('drops blank lines, and the rows of commas a spreadsheet saves for them', () => {
    expect(cells('a,b\n\n,,\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps an empty cell at the end of a row', () => {
    expect(cells('a,b,\n')).toEqual([['a', 'b', '']]);
  });

  it('reads a quoted cell with spaces before its quote', () => {
    expect(cells('a, "b,c"\n')).toEqual([['a', 'b,c']]);
  });

  it('takes a quote in the middle of a cell as text', () => {
    expect(cells('5" screen,b\n')).toEqual([['5" screen', 'b']]);
  });

  it('loses only the record whose quote never closes', () => {
    const table = parseCsv('a,b\n"oops,c\nd,e\n');
    expect(table.brokenLines).toEqual([2]);
    expect(table.rows.map((row) => row.cells)).toEqual([
      ['a', 'b'],
      ['d', 'e'],
    ]);
    expect(table.rows.map((row) => row.line)).toEqual([1, 3]);
  });

  it('finds a semicolon, tab or pipe delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3\n')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2\n')).toBe('\t');
    expect(detectDelimiter('a|b\n1|2\n')).toBe('|');
    expect(detectDelimiter('Date;Note\n1;"a,b,c,d"\n')).toBe(';');
    expect(cells('a;"b;c"\n')).toEqual([['a', 'b;c']]);
  });
});
