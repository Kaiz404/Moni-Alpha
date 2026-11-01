import { decodeFile } from '@/lib/backup/decode';
import {
  guessDateOrder,
  guessMapping,
  mappingIsComplete,
  parseImportAmount,
  parseImportDate,
  readGenericTable,
  readImportRows,
} from '@/lib/backup/generic-csv';

const dayOf = (cell: string, order: 'dmy' | 'mdy' = 'dmy') => parseImportDate(cell, order)?.day;

describe('parseImportDate', () => {
  it.each([
    ['2026-10-14', '2026-10-14'],
    ['2026/10/14', '2026-10-14'],
    ['2026-10-14 12:41', '2026-10-14'],
    ['14/10/2026', '2026-10-14'],
    ['14-10-2026', '2026-10-14'],
    ['14.10.2026', '2026-10-14'],
    ['14/10/26', '2026-10-14'],
    ['1/2/2026', '2026-02-01'],
    ['14 Oct 2026', '2026-10-14'],
    ['14-Oct-2026', '2026-10-14'],
    ['14 October 2026', '2026-10-14'],
    ['Wed 14 Oct 2026', '2026-10-14'],
    ['Oct 14, 2026', '2026-10-14'],
    ['14 Okt 2026', '2026-10-14'],
    ['3 Ogos 2026', '2026-08-03'],
    ['14/10/2026 12:41 pm', '2026-10-14'],
    ['46309', '2026-10-14'],
  ])('reads %s', (cell, day) => {
    expect(dayOf(cell)).toBe(day);
  });

  it('reads month-first dates when told to', () => {
    expect(dayOf('10/14/2026', 'mdy')).toBe('2026-10-14');
    expect(dayOf('2/1/2026', 'mdy')).toBe('2026-02-01');
  });

  it('keeps the exact instant of a timestamp with a zone', () => {
    expect(parseImportDate('2026-10-14T04:00:00.000Z', 'dmy')?.at).toBe('2026-10-14T04:00:00.000Z');
  });

  it('keeps a time of day as local time', () => {
    expect(parseImportDate('14/10/2026 12:41 pm', 'dmy')?.at).toBe(
      new Date(2026, 9, 14, 12, 41).toISOString(),
    );
    expect(parseImportDate('14/10/2026 12:05 am', 'dmy')?.at).toBe(
      new Date(2026, 9, 14, 0, 5).toISOString(),
    );
    expect(parseImportDate('14/10/2026 1:05 pm', 'dmy')?.at).toBe(
      new Date(2026, 9, 14, 13, 5).toISOString(),
    );
  });

  it.each(['', 'yesterday', '31/02/2026', '13/13/2026', '2026-13-01', '14 Foo 2026', '14/10'])(
    'refuses %s',
    (cell) => {
      expect(parseImportDate(cell, 'dmy')).toBeNull();
    },
  );

  it('refuses a day that only fits the other way round', () => {
    expect(parseImportDate('10/14/2026', 'dmy')).toBeNull();
  });
});

describe('guessDateOrder', () => {
  it('settles on day first from one day past the 12th', () => {
    expect(guessDateOrder(['01/02/2026', '14/02/2026'])).toEqual({ order: 'dmy', settled: true });
  });

  it('settles on month first the same way', () => {
    expect(guessDateOrder(['01/02/2026', '02/14/2026'])).toEqual({ order: 'mdy', settled: true });
  });

  it('asks when no date settles it, starting from day first', () => {
    expect(guessDateOrder(['01/02/2026', '03/04/2026'])).toEqual({ order: 'dmy', settled: false });
  });

  it('has nothing to ask about dates that name their month', () => {
    expect(guessDateOrder(['2026-02-01', '1 Feb 2026'])).toEqual({ order: 'dmy', settled: true });
  });
});

describe('parseImportAmount', () => {
  it.each([
    ['45.90', 4590, false, null],
    ['RM1,116.20', 111620, false, null],
    ['RM 1,116.20', 111620, false, null],
    ['-45.90', 4590, true, null],
    ['−45.90', 4590, true, null],
    ['-RM45.90', 4590, true, null],
    ['RM-45.90', 4590, true, null],
    ['(45.90)', 4590, true, null],
    ['45.90-', 4590, true, null],
    ['45.90 DR', 4590, false, 'out'],
    ['45.90 CR', 4590, false, 'in'],
    ['45.90CR', 4590, false, 'in'],
    ['45,90', 4590, false, null],
    ['1.234,56', 123456, false, null],
    ['1,234', 123400, false, null],
    ['1.234', 123400, false, null],
    ['1,234,567', 123456700, false, null],
    ['1.234.567', 123456700, false, null],
    ['45', 4500, false, null],
    ['45.9', 4590, false, null],
    ['0.07', 7, false, null],
    ['$120.00', 12000, false, null],
    [' 120.00 ', 12000, false, null],
  ])('reads %s', (cell, minor, negative, mark) => {
    expect(parseImportAmount(cell)).toEqual({ minor, negative, mark });
  });

  it.each(['', 'abc', '-', '1.2345', '12,34,56'])('refuses %s', (cell) => {
    expect(parseImportAmount(cell)).toBeNull();
  });
});

describe('readGenericTable', () => {
  it('finds the heading under lines a statement puts above its table', () => {
    const table = readGenericTable(
      'Maybank statement\nAccount 1234\n\nDate,Description,Amount\n14/10/2026,Grab,-12.00\n',
    );
    expect(table?.headers).toEqual(['Date', 'Description', 'Amount']);
    expect(table?.rows.map((row) => row.line)).toEqual([5]);
  });

  it('reads a semicolon file', () => {
    expect(readGenericTable('Date;Amount\n14/10/2026;12,50\n')?.rows[0].cells).toEqual([
      '14/10/2026',
      '12,50',
    ]);
  });

  it('has nothing to read in an empty file', () => {
    expect(readGenericTable('')).toBeNull();
  });
});

describe('guessMapping', () => {
  it('reads a Moni CSV from before ids', () => {
    expect(
      guessMapping(['Date', 'Type', 'Amount', 'Currency', 'Merchant', 'Category', 'Wallet', 'To wallet', 'Note']),
    ).toEqual({
      date: 0,
      type: 1,
      amount: 2,
      currency: 3,
      merchant: 4,
      category: 5,
      note: 8,
      moneyOut: null,
      moneyIn: null,
    });
  });

  it('reads a bank statement with money out and in, and Malay headings', () => {
    const english = guessMapping(['Posting Date', 'Description', 'Debit', 'Credit', 'Reference']);
    expect(english).toMatchObject({ date: 0, merchant: 1, moneyOut: 2, moneyIn: 3, note: 4, amount: null });
    expect(guessMapping(['Tarikh', 'Keterangan', 'Jumlah'])).toMatchObject({
      date: 0,
      merchant: 1,
      amount: 2,
    });
  });

  it('takes the first date column and does not read a Value Date as an amount', () => {
    expect(guessMapping(['Posting Date', 'Value Date', 'Details', 'Amount'])).toMatchObject({
      date: 0,
      amount: 3,
      merchant: 2,
    });
  });

  it('is complete with a date and any amount column', () => {
    expect(mappingIsComplete(guessMapping(['Date', 'Debit']))).toBe(true);
    expect(mappingIsComplete(guessMapping(['Date', 'Note']))).toBe(false);
    expect(mappingIsComplete(guessMapping(['Amount', 'Note']))).toBe(false);
  });
});

describe('readImportRows', () => {
  const read = (csv: string, order: 'dmy' | 'mdy' = 'dmy') => {
    const table = readGenericTable(csv)!;
    return readImportRows(table, guessMapping(table.headers), order);
  };
  const brief = (csv: string) =>
    read(csv).rows.map((row) => [row.day, row.type, row.amountMinor, row.merchant]);

  it('takes a negative amount as out and a positive one as in', () => {
    expect(brief('Date,Merchant,Amount\n14/10/2026,Grab,-12.00\n15/10/2026,Salary,4200\n')).toEqual([
      ['2026-10-14', 'expense', 1200, 'Grab'],
      ['2026-10-15', 'income', 420000, 'Salary'],
    ]);
  });

  it('takes a column with no negative at all as spending', () => {
    expect(brief('Date,Merchant,Amount\n14/10/2026,Grab,12.00\n').map((row) => row[1])).toEqual([
      'expense',
    ]);
  });

  it('reads money out and money in columns', () => {
    expect(brief('Date,Details,Debit,Credit\n14/10/2026,Grab,12.00,\n15/10/2026,Salary,,4200\n')).toEqual([
      ['2026-10-14', 'expense', 1200, 'Grab'],
      ['2026-10-15', 'income', 420000, 'Salary'],
    ]);
  });

  it('lets a Type column decide over the sign', () => {
    expect(brief('Date,Type,Merchant,Amount\n14/10/2026,income,Refund,12.00\n').map((row) => row[1])).toEqual([
      'income',
    ]);
  });

  it('keeps quoted commas and line breaks in a merchant', () => {
    expect(brief('Date,Merchant,Amount\n14/10/2026,"Grab, ""KL""\nCentral",-12.00\n')[0][3]).toBe(
      'Grab, "KL"\nCentral',
    );
  });

  it('says which rows it can not read, and reads the rest', () => {
    const { rows, problems } = read(
      [
        'Date,Merchant,Amount,Type',
        '14/10/2026,Grab,-12.00,',
        'someday,Kedai,-5.00,',
        '14/10/2026,Kedai,abc,',
        '14/10/2026,Kedai,0.00,',
        '14/10/2026,Top up,20.00,transfer',
        '14/10/2026,Kedai,99999999999.00,',
        '"14/10/2026,oops',
        '15/10/2026,Kopi,-3.00,',
      ].join('\n'),
    );
    expect(rows.map((row) => row.merchant)).toEqual(['Grab', 'Kopi']);
    expect(problems).toEqual([
      { line: 8, reason: 'A quote never closes' },
      { line: 3, reason: "The date can't be read" },
      { line: 4, reason: "The amount can't be read" },
      { line: 5, reason: 'The amount is zero' },
      { line: 6, reason: 'A transfer needs two wallets, so it stays out' },
      { line: 7, reason: 'The amount is too large' },
    ]);
  });

  it('reads a row shorter than its heading', () => {
    expect(brief('Date,Amount,Merchant\n14/10/2026,-12.00\n')).toEqual([
      ['2026-10-14', 'expense', 1200, null],
    ]);
  });
});

describe('decodeFile', () => {
  const bytes = (...values: number[]) => Uint8Array.from(values);
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

  it('reads UTF-8 with accents, Chinese and an emoji', () => {
    const encoded = Uint8Array.from(Buffer.from('Café,咖啡,😀', 'utf8'));
    expect(decodeFile(encoded)).toEqual({
      kind: 'text',
      encoding: 'utf-8',
      text: 'Café,咖啡,😀',
    });
  });

  it('leaves off a UTF-8 byte order mark', () => {
    expect(decodeFile(bytes(0xef, 0xbb, 0xbf, ...ascii('a,b')))).toEqual({
      kind: 'text',
      encoding: 'utf-8',
      text: 'a,b',
    });
  });

  it('reads UTF-16 with a byte order mark either way round', () => {
    const little = Uint8Array.from([0xff, 0xfe, ...Buffer.from('Café', 'utf16le')]);
    expect(decodeFile(little)).toEqual({ kind: 'text', encoding: 'utf-16le', text: 'Café' });
    expect(decodeFile(bytes(0xfe, 0xff, 0, 0x61, 0, 0x62))).toEqual({
      kind: 'text',
      encoding: 'utf-16be',
      text: 'ab',
    });
  });

  it('recognises UTF-16 with no byte order mark', () => {
    expect(decodeFile(Uint8Array.from(Buffer.from('Date,Amount\n', 'utf16le')))).toEqual({
      kind: 'text',
      encoding: 'utf-16le',
      text: 'Date,Amount\n',
    });
  });

  it('falls back to Windows-1252 for bytes that are not valid UTF-8', () => {
    expect(decodeFile(bytes(0x43, 0x61, 0x66, 0xe9, 0x20, 0x80))).toEqual({
      kind: 'text',
      encoding: 'windows-1252',
      text: 'Café €',
    });
  });

  it('reads a cut-off UTF-8 sequence as Windows-1252, not as an error', () => {
    expect(decodeFile(bytes(0x61, 0xe2, 0x82)).kind).toBe('text');
  });

  it('knows a workbook and a binary file are not text', () => {
    expect(decodeFile(bytes(0x50, 0x4b, 0x03, 0x04, 1))).toEqual({ kind: 'workbook' });
    expect(decodeFile(bytes(0xd0, 0xcf, 0x11, 0xe0, 1))).toEqual({ kind: 'workbook' });
    expect(decodeFile(bytes(1, 2, 0, 4, 0, 0, 7))).toEqual({ kind: 'binary' });
  });

  it('reads a long file past the argument limit of one conversion', () => {
    const long = new Uint8Array(200_000).fill(0x61);
    const decoded = decodeFile(long);
    expect(decoded.kind === 'text' && decoded.text.length).toBe(200_000);
  });
});
