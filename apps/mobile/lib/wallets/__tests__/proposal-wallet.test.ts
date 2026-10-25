import { lastWalletForMerchant } from '@/lib/wallets/proposal-wallet';

const row = (merchant: string | null, walletId: string, transactionDate: string) => ({
  merchant,
  walletId,
  transactionDate,
});

describe('lastWalletForMerchant', () => {
  const wallets = new Set(['maybank', 'tng']);

  it('picks the wallet of the latest payment to the same merchant', () => {
    const rows = [
      row('Parking KLCC', 'maybank', '2026-10-01T09:00:00.000Z'),
      row('PARKING KLCC', 'tng', '2026-10-08T09:00:00.000Z'),
      row('Jaya Grocer', 'maybank', '2026-10-12T09:00:00.000Z'),
    ];
    expect(lastWalletForMerchant('parking klcc', rows, wallets)).toBe('tng');
  });

  it('skips wallets the sheet does not offer', () => {
    const rows = [
      row('Parking KLCC', 'maybank', '2026-10-01T09:00:00.000Z'),
      row('Parking KLCC', 'wise', '2026-10-09T09:00:00.000Z'),
    ];
    expect(lastWalletForMerchant('Parking KLCC', rows, wallets)).toBe('maybank');
  });

  it('suggests nothing without a merchant or a match', () => {
    const rows = [row('Parking KLCC', 'maybank', '2026-10-01T09:00:00.000Z')];
    expect(lastWalletForMerchant(null, rows, wallets)).toBeNull();
    expect(lastWalletForMerchant('Shopee', rows, wallets)).toBeNull();
  });
});
