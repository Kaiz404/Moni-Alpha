import { useCallback, useMemo } from 'react';
import { observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { walletsNeedingConfirmation, type WalletToConfirm } from '@/lib/ai/facts/confirmation';
import { dayNumber } from '@/lib/ai/facts/days';
import { MIN_HISTORY_DAYS, historyDays } from '@/lib/ai/facts/forecast';
import { useAuth } from '@/lib/auth/auth-context';
import { transactions$, walletsForUser$ } from '@/lib/finance/selectors';
import type { FinanceWallet } from '@/lib/finance/types';
import { preferencesMMKV } from '@/lib/mmkv/preferences';

export const BALANCE_CONFIRMATION_DISMISSED_KEY = 'balance-confirmation-dismissed-until';
export const BALANCE_CONFIRMATION_SNOOZE_DAYS = 7;

const dismissedUntil$ = observable(
  Date.parse(preferencesMMKV.getString(BALANCE_CONFIRMATION_DISMISSED_KEY) ?? '') || 0,
);

/**
 * Wallets to ask about, empty while "Not now" is in effect or when confirming would not unlock
 * a forecast because that currency has under MIN_HISTORY_DAYS of history.
 */
export function useBalanceConfirmation(): {
  wallets: WalletToConfirm<FinanceWallet>[];
  dismiss: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wallets = useValue(walletsForUser$(userId));
  const transactions = useValue(transactions$({ userId }));
  const dismissedUntil = useValue(dismissedUntil$);

  const due = useMemo(() => {
    const now = new Date();
    return walletsNeedingConfirmation(wallets, transactions, now).filter(
      ({ wallet }) =>
        historyDays(
          transactions.filter((tx) => tx.currency === wallet.currency),
          dayNumber(now),
        ) >= MIN_HISTORY_DAYS,
    );
  }, [wallets, transactions]);

  const dismiss = useCallback(() => {
    const until = Date.now() + BALANCE_CONFIRMATION_SNOOZE_DAYS * 86_400_000;
    preferencesMMKV.set(BALANCE_CONFIRMATION_DISMISSED_KEY, new Date(until).toISOString());
    dismissedUntil$.set(until);
  }, []);

  return { wallets: Date.now() < dismissedUntil ? [] : due, dismiss };
}
