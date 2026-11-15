import { decimalToMinor } from '@repo/types';

import { balanceDiffLine, checkedLabel } from '../wallet-page';

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
