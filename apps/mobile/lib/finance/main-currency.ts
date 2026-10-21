import { useValue } from '@legendapp/state/react';
import type { CurrencyCode, UserPreferences } from '@repo/types';
import { profilePreferences$ } from '@/lib/store';

const DEFAULT_MAIN_CURRENCY = 'MYR' as CurrencyCode;

export function selectMainCurrency(
  preferences: Partial<UserPreferences> | null | undefined,
): CurrencyCode {
  return (preferences?.currency || DEFAULT_MAIN_CURRENCY).toUpperCase() as CurrencyCode;
}

/** The currency totals count in. Persisted, so it holds through a cold start offline. */
export function useMainCurrency(): CurrencyCode {
  return useValue(() => selectMainCurrency(profilePreferences$.get()));
}
