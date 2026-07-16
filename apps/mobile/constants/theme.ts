/**
 * Design tokens for JS APIs that cannot use className (tab bar, charts, icons).
 * Semantic colors live in `global.css` — change brand there, not here.
 * Prefer `useThemeTokens()` / `useCSSVariable` in components.
 */

/** Fallback hex when CSS variables are not yet resolved (SSR / first paint). */
export const ThemeFallbacks = {
  primary: '#059669',
  primarySoft: '#10b981',
  primaryForeground: '#ffffff',
  accent: '#10b981',
  background: '#ffffff',
  backgroundDark: '#0a0a0a',
  foreground: '#111111',
  foregroundDark: '#fafafa',
  muted: '#6b7280',
  mutedDark: '#a1a1aa',
  border: '#e6e7e5',
  danger: '#dc2626',
  income: '#059669',
  expense: '#dc2626',
  transfer: '#0284c7',
  chart: ['#059669', '#0d9488', '#0284c7', '#7c3aed', '#db2777', '#d97706'] as const,
} as const;
