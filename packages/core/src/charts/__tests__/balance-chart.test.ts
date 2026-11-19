import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { createCalendar } from '../../calendar';
import { balanceIndex } from '../../read-model/balance-history';
import { balanceChart } from '../balance-chart';

const UTC = createCalendar('UTC');
const now = new Date('2026-10-14T12:00:00.000Z');
const box = { width: 312, height: 108, axis: 0, top: 8, bottom: 8 };

describe('balanceChart', () => {
  const index = balanceIndex({
    now,
    calendar: UTC,
    wallets: [
      { id: 'mb', balanceMinor: 30000, createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'card', balanceMinor: -10000, createdAt: '2026-10-01T00:00:00.000Z' },
    ],
    transactions: [
      { walletId: 'mb', transferToWalletId: null, amountMinor: 10000 as MinorAmount, type: 'income', transactionDate: '2026-10-10T03:00:00.000Z' },
    ],
  });

  it('draws net worth across the month so far, from the base up, ending on Today', () => {
    const chart = balanceChart({ index, series: 'total', now, range: '1m', calendar: UTC, currency: 'MYR', box });
    expect(chart.labels.map((label) => label.text)).toEqual(['RM0', 'RM50', 'RM100', 'RM150', 'RM200']);
    expect(chart.days).toHaveLength(14);
    expect([chart.days[0]!.value, chart.days.at(-1)!.value]).toEqual(['RM100.00', 'RM200.00']);
    expect(chart.changeMinor).toBe(10000);
    expect(chart.ticks.at(-1)).toEqual({ x: 306, text: 'Today', today: true });
  });

  it('reaches below zero for a card that is owed', () => {
    const chart = balanceChart({ index, series: 'card', now, range: '1m', calendar: UTC, currency: 'MYR', box });
    expect(chart.labels.map((label) => label.text)).toEqual(['−RM100', '−RM75', '−RM50', '−RM25', 'RM0']);
    expect(chart.changeMinor).toBe(0);
  });
});
