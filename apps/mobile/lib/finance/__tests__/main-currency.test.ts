import { selectMainCurrency } from '../main-currency';

jest.mock('@/lib/store', () => ({ profilePreferences$: {} }));

describe('selectMainCurrency', () => {
  it('falls back to MYR when the profile has no currency', () => {
    expect(selectMainCurrency({})).toBe('MYR');
    expect(selectMainCurrency(undefined)).toBe('MYR');
  });

  it("uses the profile's currency", () => {
    expect(selectMainCurrency({ currency: 'SGD' })).toBe('SGD');
  });
});
