import { currencyHeldIn, currencyName } from '../currency-words';

describe('currencyName', () => {
  it('writes currency names in sentence case', () => {
    expect(currencyName('MYR')).toBe('Malaysian ringgit');
    expect(currencyName('usd')).toBe('US dollar');
    expect(currencyName('EUR')).toBe('Euro');
    expect(currencyName('XYZ')).toBe('XYZ');
  });
});

describe('currencyHeldIn', () => {
  it('names what wallets are held in, as the Profile Wallets row says it', () => {
    expect(currencyHeldIn('MYR')).toBe('ringgit');
    expect(currencyHeldIn('USD')).toBe('US dollars');
    expect(currencyHeldIn('JPY')).toBe('Japanese yen');
    expect(currencyHeldIn('XYZ')).toBe('XYZ');
  });
});
