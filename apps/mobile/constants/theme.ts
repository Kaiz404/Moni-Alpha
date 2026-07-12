/**
 * Design tokens for JS APIs that cannot use className (tab bar, charts, icons).
 * Semantic colors live in `global.css` — change brand there, not here.
 * Prefer `useThemeTokens()` / `useCSSVariable` in components.
 */

import { Platform } from 'react-native';

/** Fallback hex when CSS variables are not yet resolved (SSR / first paint). */
export const ThemeFallbacks = {
  primary: '#059669',
  primarySoft: '#10b981',
  primaryForeground: '#ffffff',
  accent: '#10b981',
  background: '#ffffff',
  backgroundDark: '#0b1210',
  foreground: '#0f172a',
  foregroundDark: '#ecfdf5',
  muted: '#64748b',
  mutedDark: '#94a3b8',
  border: '#d8e5de',
  danger: '#dc2626',
  income: '#059669',
  expense: '#dc2626',
  transfer: '#0284c7',
  chart: ['#059669', '#0d9488', '#0284c7', '#7c3aed', '#db2777', '#d97706'] as const,
} as const;

/**
 * @deprecated Prefer semantic Uniwind classes (`bg-background`, `text-foreground`)
 * or `useThemeTokens()`. Kept for gradual migration of ThemedText/ThemedView.
 */
export const Colors = {
  light: {
    text: ThemeFallbacks.foreground,
    background: ThemeFallbacks.background,
    tint: ThemeFallbacks.primary,
    accent: ThemeFallbacks.accent,
    icon: ThemeFallbacks.muted,
    tabIconDefault: ThemeFallbacks.muted,
    tabIconSelected: ThemeFallbacks.primary,
  },
  dark: {
    text: ThemeFallbacks.foregroundDark,
    background: ThemeFallbacks.backgroundDark,
    tint: ThemeFallbacks.primarySoft,
    accent: ThemeFallbacks.accent,
    icon: ThemeFallbacks.mutedDark,
    tabIconDefault: ThemeFallbacks.mutedDark,
    tabIconSelected: ThemeFallbacks.primarySoft,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
