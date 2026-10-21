import { merchantName } from '../merchant-name';

const aliases = [{ rawKey: 'grab', displayName: 'Grab' }];

describe('merchantName', () => {
  it("shows the user's name for a raw alert merchant", () => {
    expect(merchantName('GRAB*1234 KL', aliases)).toBe('Grab');
    expect(merchantName('Grab A-98QZ', aliases)).toBe('Grab');
  });

  it('keeps the raw text for a merchant without a name', () => {
    expect(merchantName('KEDAI ABC', aliases)).toBe('KEDAI ABC');
    expect(merchantName(null, aliases)).toBe(null);
  });
});
