import { decimalToMinor } from '@repo/types';

import { balanceDiffLine, checkedLabel, formatDayTotal, groupWalletDays } from '../wallet-page';
import { expense } from './balance-fixture';

const NOW = new Date(2026, 9, 14, 14, 6);
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();
const bank = { kind: 'app', name: 'MAE' } as const;

describe('checkedLabel', () => {
  it.each([
    [null, 'Never checked'],
    [at(14, 9), 'Checked today'],
    [at(13, 23), 'Last checked yesterday'],
    [new Date(2026, 8, 4, 10).toISOString(), 'Last checked 40 days ago'],
  ])('reads %p as %p', (confirmedAt, label) => {
    expect(checkedLabel(confirmedAt, NOW)).toBe(label);
  });
});

describe('balanceDiffLine', () => {
  const cash = decimalToMinor('63.60');

  it('asks for the balance until the field holds an amount', () => {
    expect(balanceDiffLine(cash, 'MYR', null, bank)).toBe('Type the balance your MAE app shows.');
    expect(balanceDiffLine(cash, 'MYR', null, { kind: 'cash' })).toBe('Type the cash you have.');
  });

  it('says what Moni has when the typed balance matches', () => {
    expect(balanceDiffLine(cash, 'MYR', 63.6, { kind: 'cash' })).toBe(
      'Moni has RM63.60. Type what you count.',
    );
  });

  it('names the correction it will add', () => {
    expect(balanceDiffLine(cash, 'MYR', 60, bank)).toBe(
      'Moni adds a −RM3.60 balance correction. Not counted as spending or income.',
    );
    expect(balanceDiffLine(decimalToMinor('120'), 'USD', 125.5, bank)).toBe(
      'Moni adds a +$5.50 balance correction. Not counted as spending or income.',
    );
  });
});

describe('groupWalletDays', () => {
  it('groups by local day and totals income minus expenses, leaving transfers out', () => {
    const days = groupWalletDays(
      [
        expense('a', at(13, 20), { amountMinor: decimalToMinor('45.90') }),
        expense('b', at(13, 9), {
          type: 'transfer',
          amountMinor: decimalToMinor('100'),
          transferToWalletId: 'tng',
        }),
        expense('c', at(12), { amountMinor: decimalToMinor('30.40') }),
        expense('d', at(12, 8), { type: 'income', amountMinor: decimalToMinor('50') }),
      ],
      NOW,
    );
    expect(
      days.map((day) => [
        day.label,
        formatDayTotal(day.totalMinor, 'MYR'),
        day.items.map((item) => item.id),
      ]),
    ).toEqual([
      ['Yesterday · Tue 13 Oct', '−RM45.90', ['a', 'b']],
      ['Mon 12 Oct', '+RM19.60', ['c', 'd']],
    ]);
  });
});
