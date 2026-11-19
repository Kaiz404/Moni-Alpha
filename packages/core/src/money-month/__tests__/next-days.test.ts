import type { MinorAmount, UpcomingBill } from '@repo/types';
import { describe, expect, it } from 'vitest';

import type { ComingUpRow } from '../../read-model/debt-summary';
import type { FinanceDebt } from '../../read-model/types';
import { nextDays } from '../next-days';

const bill = (name: string, dueDate: string, amount: number, status: UpcomingBill['status'] = 'due'): UpcomingBill => ({
  seriesKey: name.toLowerCase(),
  name,
  amountMinor: amount as MinorAmount,
  currency: 'MYR',
  dueDate,
  status,
  walletId: null,
  categoryId: 'subs',
});
const debt = (name: string, direction: FinanceDebt['direction'], dueDate: string, balance: number): ComingUpRow =>
  ({
    line: { debt: { id: name, counterpartyName: name, direction, currency: 'MYR' }, balanceMinor: balance },
    dueDate,
    daysLeft: 0,
  }) as unknown as ComingUpRow;

describe('nextDays', () => {
  const next = nextDays({
    bills: [
      bill('Unifi fibre', '2026-10-25', 12900),
      bill('Netflix', '2026-10-15', 5490),
      bill('Spotify', '2026-10-22', 1690),
      bill('Gym', '2026-10-10', 9000),
      bill('Astro', '2026-10-30', 9900),
      bill('Water', '2026-10-16', 3000, 'paid'),
    ],
    comingUp: [debt('Mei', 'i_owe', '2026-10-20', 4000), debt('Ali', 'owed_to_me', '2026-10-21', 2500)],
    today: '2026-10-14',
    currency: 'MYR',
  });

  it('lists bills and debts due in the next 14 days in date order', () => {
    expect(next.items.map((item) => [item.when, item.name, item.kind])).toEqual([
      ['Tomorrow', 'Netflix', 'bill'],
      ['Tue 20 Oct', 'To Mei', 'owe'],
      ['Wed 21 Oct', 'From Ali', 'owed'],
      ['Thu 22 Oct', 'Spotify', 'bill'],
      ['Sun 25 Oct', 'Unifi fibre', 'bill'],
    ]);
  });

  it('sets aside the bills and what the user owes, not what they are owed', () => {
    expect(next.setAsideMinor).toBe(5490 + 4000 + 1690 + 12900);
  });
});
