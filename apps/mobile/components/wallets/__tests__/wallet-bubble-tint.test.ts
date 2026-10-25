import { walletBubbleTint } from '@/constants/wallet-card-styles';

describe('walletBubbleTint', () => {
  it('follows the stored card style, so an Aqua bank wallet stays Aqua', () => {
    expect(walletBubbleTint('ocean-deep', 'bank')).toBe('aqua');
    expect(walletBubbleTint('citrus-pop', 'bank')).toBe('lemon');
    expect(walletBubbleTint('violet-dusk', 'ewallet')).toBe('lilac');
  });

  it('falls back to the wallet type without a known style', () => {
    expect(walletBubbleTint(null, 'cash')).toBe('mint');
    expect(walletBubbleTint('retired-style', 'investment')).toBe('sky');
    expect(walletBubbleTint(null, 'unknown')).toBe('sand');
  });
});
