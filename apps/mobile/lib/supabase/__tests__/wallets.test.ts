import type { Observable } from '@legendapp/state';
import { confirmWalletBalance } from '../wallets';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: jest.fn() }));
jest.mock('@/lib/supabase/balances', () => ({ getWalletBalances: jest.fn() }));
jest.mock('@/lib/notifications/linked-packages-cache', () => ({
  refreshLinkedPackagesFromStore: jest.fn(),
}));
jest.mock('@/lib/wallets/default-wallet', () => ({ clearDefaultWalletIfDeleted: jest.fn() }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { wallets$: observable({}), transactions$: observable({}) };
});

const { wallets$ } = jest.requireMock('@/lib/store') as {
  wallets$: Observable<Record<string, Record<string, unknown>>>;
};

const row = {
  id: 'w1',
  user_id: 'user-1',
  name: 'Maybank',
  type: 'bank',
  currency: 'MYR',
  initial_balance: '3000.00',
  is_active: true,
  balance_confirmed_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted: false,
};

describe('confirmWalletBalance', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-12T02:00:00.000Z'));
    wallets$.set({ w1: { ...row } });
  });
  afterEach(() => jest.useRealTimers());

  it('stamps balance_confirmed_at now and changes nothing else', () => {
    confirmWalletBalance('w1');
    expect(wallets$.w1.peek()).toEqual({
      ...row,
      balance_confirmed_at: '2026-10-12T02:00:00.000Z',
      updated_at: '2026-10-12T02:00:00.000Z',
    });
  });

  it('refuses a deleted wallet rather than reviving it', () => {
    wallets$.w1.deleted.set(true);
    expect(() => confirmWalletBalance('w1')).toThrow('Cannot patch missing row: w1');
    expect(wallets$.w1.balance_confirmed_at.peek()).toBe(row.balance_confirmed_at);
  });
});
