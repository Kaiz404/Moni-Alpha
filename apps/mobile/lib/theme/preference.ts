import { Uniwind } from 'uniwind';
import { preferencesMMKV } from '@/lib/mmkv/preferences';
import { markThemeRequested } from '@/lib/theme/theme-commit';

export const THEME_PREFERENCE_KEY = 'theme-preference';

/** User-selectable appearance modes. Default is light (not device-adaptive). */
export type ThemePreference = 'light' | 'dark' | 'system';

const DEFAULT_PREFERENCE: ThemePreference = 'light';

function isThemePreference(value: string | undefined): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getThemePreference(): ThemePreference {
  const stored = preferencesMMKV.getString(THEME_PREFERENCE_KEY);
  return isThemePreference(stored) ? stored : DEFAULT_PREFERENCE;
}

/** Persist preference and apply it through Uniwind immediately. */
export function setThemePreference(preference: ThemePreference): void {
  preferencesMMKV.set(THEME_PREFERENCE_KEY, preference);
  markThemeRequested();
  Uniwind.setTheme(preference);
}

/** Call once at app startup (before first paint if possible). */
export function applyStoredThemePreference(): void {
  Uniwind.setTheme(getThemePreference());
}

/** Effective selection for UI (system when adaptive themes are on). */
export function resolveActivePreference(
  theme: string,
  hasAdaptiveThemes: boolean,
): ThemePreference {
  if (hasAdaptiveThemes) return 'system';
  if (theme === 'dark') return 'dark';
  return 'light';
}
