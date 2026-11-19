import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { createCalendar } from '../../calendar';
import { walletToCheckIn } from '../check-in';
import type { FinanceWallet } from '../types';
import { merchantAliasesFromRows, recurringOverridesFromRows } from '../user-rows';

const calendar = createCalendar('Asia/Kuala_Lumpur');
const now = new Date('2026-10-14T07:00:00.000Z');
const wallet = (id: string, over: Partial<FinanceWallet> = {}) =>
  ({ id, name: id, type: 'bank', currency: 'MYR', isActive: true, displayOrder: 0, balanceConfirmedAt: null, ...over }) as FinanceWallet;

describe('walletToCheckIn', () => {
  const wallets = [
    wallet('maybank', { balanceConfirmedAt: '2026-09-04T02:00:00.000Z' }),
    wallet('tng', { type: 'ewallet', displayOrder: 1, balanceConfirmedAt: '2026-10-10T02:00:00.000Z' }),
    wallet('card', { type: 'credit_card', displayOrder: 2 }),
    wallet('wise', { currency: 'USD', displayOrder: 3 }),
  ];
  const balancesByWallet = { maybank: 228180 as MinorAmount, tng: 8640 as MinorAmount, card: -5000 as MinorAmount, wise: 12000 as MinorAmount };

  it('asks about the main-currency wallet whose balance went longest without a look, counting days in the zone', () => {
    expect(
      walletToCheckIn({ wallets, balancesByWallet, lastUsedByWallet: {}, currency: 'MYR', now, calendar }),
    ).toEqual({ wallet: wallets[0], balanceMinor: 228180, daysAgo: 40 });
    expect(
      walletToCheckIn({ wallets, balancesByWallet, lastUsedByWallet: {}, currency: 'MYR', now, calendar: createCalendar('America/New_York') })?.daysAgo,
    ).toBe(41);
  });

  it('asks nothing once every wallet was confirmed within 30 days', () => {
    const fresh = wallets.map((each) => ({ ...each, balanceConfirmedAt: '2026-10-01T02:00:00.000Z' }));
    expect(walletToCheckIn({ wallets: fresh, balancesByWallet, lastUsedByWallet: {}, currency: 'MYR', now, calendar })).toBeNull();
  });
});

describe('user rows', () => {
  it('keeps the newest verdict per series and drops deleted and other users’ rows', () => {
    const overrides = recurringOverridesFromRows(
      {
        a: { id: 'a', user_id: 'u', series_key: 'netflix', status: 'confirmed', kind: 'subscription', expected_amount: '54.90', expected_day: 15, currency: 'myr', updated_at: '2026-10-01' },
        b: { id: 'b', user_id: 'u', series_key: 'netflix', status: 'dismissed', updated_at: '2026-10-02' },
        c: { id: 'c', user_id: 'u', series_key: 'unifi', deleted: true },
        d: { id: 'd', user_id: 'other', series_key: 'x' },
      },
      'u',
    );
    expect(overrides.map((override) => [override.id, override.status])).toEqual([['b', 'dismissed']]);
  });

  it('reads a verdict row into minor units and an upper-case currency', () => {
    expect(
      recurringOverridesFromRows(
        {
          a: {
            id: 'a',
            user_id: 'u',
            series_key: 'MYR|expense|netflix',
            status: 'confirmed',
            kind: 'subscription',
            expected_amount: '55.00',
            expected_day: 10,
            currency: 'myr',
            remind: true,
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: null,
          },
        },
        'u',
      ),
    ).toEqual([
      {
        id: 'a',
        userId: 'u',
        seriesKey: 'MYR|expense|netflix',
        status: 'confirmed',
        kind: 'subscription',
        expectedAmountMinor: 5500,
        expectedDay: 10,
        currency: 'MYR',
        skipPeriod: null,
        remind: true,
        name: null,
        walletId: null,
        categoryId: null,
        dueOnce: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ]);
  });

  it('names a merchant key by its latest alias', () => {
    const aliases = merchantAliasesFromRows(
      {
        a: { id: 'a', user_id: 'u', raw_key: 'shell 123', display_name: 'Shell', updated_at: '2026-10-01' },
        b: { id: 'b', user_id: 'u', raw_key: 'shell 123', display_name: 'Shell Bangsar', updated_at: '2026-10-03' },
      },
      'u',
    );
    expect(aliases.map((alias) => alias.displayName)).toEqual(['Shell Bangsar']);
  });
});
