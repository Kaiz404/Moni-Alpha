import { decimalToMinor } from '@repo/types';
import { walletsNeedingConfirmation } from '../confirmation';
import type { FactsTransaction } from '../recurring';
import { BANK, tx, wallet } from './synthetic-ledger';

const NOW = new Date(2026, 9, 12, 10);
const confirmed = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
const spend: FactsTransaction[] = [tx(new Date(2026, 9, 1, 12), 'expense', '100', 'Mamak Corner')];

function due(wallets: Parameters<typeof walletsNeedingConfirmation>[0], rows = spend) {
  return walletsNeedingConfirmation(wallets, rows, NOW).map((w) => [
    w.wallet.id,
    w.balanceMinor,
    w.daysSinceConfirmed,
  ]);
}

describe('walletsNeedingConfirmation', () => {
  it('lists a balance confirmed over 30 days ago, with its balance today', () => {
    expect(due([wallet({ balanceConfirmedAt: confirmed(40) })])).toEqual([[BANK, 290000, 40]]);
  });

  it('lists a balance never confirmed', () => {
    expect(due([wallet()])).toEqual([[BANK, 290000, null]]);
  });

  it('leaves out a balance confirmed within 30 days', () => {
    expect(due([wallet({ balanceConfirmedAt: confirmed(30) })])).toEqual([]);
    expect(due([wallet({ balanceConfirmedAt: confirmed(31) })])).toEqual([[BANK, 290000, 31]]);
  });

  it('leaves out a dormant empty wallet and wallets the forecast does not count', () => {
    expect(
      due([
        wallet({ balanceConfirmedAt: confirmed(3) }),
        wallet({ id: 'cash', type: 'cash', initialBalanceMinor: decimalToMinor('0') }),
        wallet({ id: 'card', type: 'credit' }),
        wallet({ id: 'closed', isActive: false }),
      ]),
    ).toEqual([]);
  });

  it('keeps each wallet in its own currency and in input order', () => {
    const rows = [
      ...spend,
      tx(new Date(2026, 9, 2, 12), 'expense', '20', 'Hawker', {
        walletId: 'dbs',
        currency: 'SGD',
      }),
    ];
    const result = walletsNeedingConfirmation(
      [
        wallet({ id: 'dbs', currency: 'SGD', initialBalanceMinor: decimalToMinor('500') }),
        wallet({ balanceConfirmedAt: confirmed(45) }),
      ],
      rows,
      NOW,
    );
    expect(
      result.map((w) => [w.wallet.id, w.wallet.currency, w.balanceMinor, w.daysSinceConfirmed]),
    ).toEqual([
      ['dbs', 'SGD', 48000, null],
      [BANK, 'MYR', 290000, 45],
    ]);
  });

  it('counts an empty wallet used only through transfers, and the transfer in its balance', () => {
    const rows = [
      ...spend,
      tx(new Date(2026, 9, 5, 10), 'transfer', '50', null, { transferToWalletId: 'tng' }),
      tx(new Date(2026, 9, 20, 10), 'transfer', '70', null, { transferToWalletId: 'tng' }),
    ];
    expect(
      due(
        [
          wallet({ balanceConfirmedAt: confirmed(3) }),
          wallet({ id: 'tng', type: 'ewallet', initialBalanceMinor: decimalToMinor('0') }),
        ],
        rows,
      ),
    ).toEqual([['tng', 5000, null]]);
  });
});
