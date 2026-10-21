import { decimalToMinor } from '@repo/types';
import { render, screen } from '@testing-library/react-native';

import { expense, financeWallet } from '@/lib/wallets/__tests__/balance-fixture';
import { WalletBalanceChart } from '../wallet-balance-chart';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const now = new Date(2026, 9, 14, 14, 6);
const on = (day: number) => new Date(2026, 9, day, 12).toISOString();

describe('WalletBalanceChart', () => {
  it('says how far the balance moved since the 1st and what went in, out, and between wallets', () => {
    const wallet = financeWallet();
    render(
      <WalletBalanceChart
        wallet={wallet}
        now={now}
        transactions={[
          expense('pay', on(1), { type: 'income', amountMinor: decimalToMinor('4550') }),
          expense('grab', on(13), { amountMinor: decimalToMinor('45.90') }),
          expense('tng', on(12), {
            type: 'transfer',
            transferToWalletId: 'tng',
            amountMinor: decimalToMinor('100'),
          }),
          expense('fix', on(5), { balanceCorrection: true, amountMinor: decimalToMinor('3') }),
          expense('sept', new Date(2026, 8, 30, 12).toISOString()),
        ]}
      />,
    );

    expect(screen.getByText('October')).toBeTruthy();
    expect(screen.getByText('Down RM148.90 since 1 Oct')).toBeTruthy();
    expect(screen.getByText('In +RM4,550.00 · Out −RM45.90 · Moved RM100.00')).toBeTruthy();
    expect(screen.getByTestId('wallet.chart.day.2026-10-14')).toBeTruthy();
  });
});
