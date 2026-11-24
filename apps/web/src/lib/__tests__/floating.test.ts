import { describe, expect, it } from 'vitest';
import { typeAheadIndex } from '../floating';

describe('typeAheadIndex', () => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June'];
  const years = ['2026', '2001', '1999', '1995', '1990'];

  it('finds the first row a typed prefix starts, from the focused row on', () => {
    expect(typeAheadIndex(years, 0, '1995')).toBe(3);
    expect(typeAheadIndex(months, 0, 'ju')).toBe(5);
  });

  it('ignores case and the spaces around a label', () => {
    expect(typeAheadIndex([' Food ', '  Fuel'], 0, 'FU')).toBe(1);
  });

  it('moves to the next row with the same letter when one letter is typed again', () => {
    expect(typeAheadIndex(months, 2, 'm')).toBe(4);
    expect(typeAheadIndex(months, 4, 'mm')).toBe(2);
  });

  it('keeps the focused row while a longer prefix still matches it', () => {
    expect(typeAheadIndex(months, 2, 'ma')).toBe(2);
  });

  it('is -1 when no row starts with the text', () => {
    expect(typeAheadIndex(months, 0, 'z')).toBe(-1);
  });
});
