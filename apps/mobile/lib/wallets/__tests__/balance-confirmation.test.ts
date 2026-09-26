import { act, renderHook } from '@testing-library/react-native';
import { financeProjection$ } from '@/lib/finance/projection';
import { preferencesMMKV } from '@/lib/mmkv/preferences';
import {
  BALANCE_CONFIRMATION_DISMISSED_KEY,
  useBalanceConfirmation,
} from '../balance-confirmation';
import { NOW, daysAgo, expense, financeWallet, projection } from './balance-fixture';

jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'user_1' } }) }));

const ids = () => renderHook(useBalanceConfirmation).result.current.wallets.map((w) => w.wallet.id);

describe('useBalanceConfirmation', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  it('asks about a stale wallet once its currency has enough history', () => {
    financeProjection$.set(
      projection([financeWallet(), financeWallet({ id: 'tng', balanceConfirmedAt: daysAgo(2) })]),
    );
    expect(ids()).toEqual(['maybank']);
  });

  it('stays quiet when confirming would not unlock a forecast yet', () => {
    financeProjection$.set(projection([financeWallet()], [expense('t1', daysAgo(20))]));
    expect(ids()).toEqual([]);
  });

  it('stays quiet when every balance is fresh', () => {
    financeProjection$.set(projection([financeWallet({ balanceConfirmedAt: daysAgo(5) })]));
    expect(ids()).toEqual([]);
  });

  it('hides for seven days after "Not now", then asks again', () => {
    financeProjection$.set(projection([financeWallet()]));
    const { result, rerender } = renderHook(useBalanceConfirmation);

    act(() => result.current.dismiss());
    expect(result.current.wallets).toEqual([]);
    expect(preferencesMMKV.getString(BALANCE_CONFIRMATION_DISMISSED_KEY)).toBe(
      new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
    );

    jest.setSystemTime(NOW.getTime() + 7 * 86_400_000 - 1);
    rerender({});
    expect(result.current.wallets).toEqual([]);

    jest.setSystemTime(NOW.getTime() + 7 * 86_400_000);
    rerender({});
    expect(result.current.wallets.map((w) => w.wallet.id)).toEqual(['maybank']);
  });
});
