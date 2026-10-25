import { spokenAmount } from '@/lib/capture/spoken-amount';

describe('spokenAmount', () => {
  it.each([
    ['kopi and kaya toast at Kopitiam, nine eighty', 980, 'nine eighty'],
    ['paid 6 ringgit parking at KLCC', 600, '6 ringgit'],
    ['grab to the office RM12.50 this morning', 1250, 'RM12.50'],
    ['lunch twenty-five ringgit fifty sen with Mei', 2550, 'twenty-five ringgit fifty sen'],
    ['nasi lemak 9.8', 980, '9.8'],
    ['parking fifty cents', 50, 'fifty cents'],
    ['petrol one hundred and twenty', 12000, 'one hundred and twenty'],
    ['petrol one twenty at Shell', 12000, 'one twenty'],
    ['bread three point five', 350, 'three point five'],
    ['rent two thousand three hundred', 230000, 'two thousand three hundred'],
    ['kopi 980 at the mamak', 980, '980'],
  ])('finds the words in "%s" that said %i', (transcript, amountMinor, expected) => {
    expect(spokenAmount(transcript, amountMinor)).toBe(expected);
  });

  it('returns null when no words say the amount', () => {
    expect(spokenAmount('kopi and kaya toast at Kopitiam, nine eighty', 1050)).toBeNull();
    expect(spokenAmount('kopi and kaya toast at Kopitiam, nine eighty', 980)).toBe('nine eighty');
  });

  it('prefers the full amount over a number inside it', () => {
    expect(spokenAmount('2 kopi for 8 ringgit 40', 840)).toBe('8 ringgit 40');
  });
});
