import { typedDisplay, typedMinor, typeKey } from '../typed-amount';

const typeAll = (keys: Parameters<typeof typeKey>[1][]) =>
  keys.reduce((text, key) => typeKey(text, key), '');

describe('the debt amount keypad', () => {
  it('reads 1, 2, 5, point, 5 as RM125.5 and 12550 sen', () => {
    const text = typeAll(['1', '2', '5', '.', '5']);
    expect(text).toBe('125.5');
    expect(typedDisplay(text, 'MYR')).toBe('RM125.5');
    expect(typedMinor(text)).toBe(12550);
  });

  it('keeps two decimals and drops a leading zero', () => {
    expect(typeAll(['0', '4', '.', '9', '9', '9'])).toBe('4.99');
  });

  it('starts a point from zero and deletes back to nothing', () => {
    expect(typeAll(['.', '5'])).toBe('0.5');
    expect(typeAll(['7', 'back'])).toBe('');
    expect(typedMinor('20.')).toBe(2000);
    expect(typedDisplay('', 'MYR')).toBe('RM0');
  });
});
