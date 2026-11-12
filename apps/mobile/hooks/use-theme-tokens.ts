import { createContext, use, useMemo } from 'react';
import { useCSSVariable } from 'uniwind';

import { lightThemeTokens, themeTokenNames } from '@/constants/theme-tokens.generated';

const variableNames = themeTokenNames.map((name) => `--color-${name}`);

function buildThemeTokens(values: readonly (string | number | undefined)[]) {
  const t = { ...lightThemeTokens };
  themeTokenNames.forEach((name, index) => {
    const value = values[index];
    if (typeof value === 'string' && value.length > 0) t[name] = value;
  });

  return {
    primary: t.primary,
    primaryForeground: t['primary-foreground'],
    primaryMuted: t['primary-muted'],
    accent: t.accent,
    accents: {
      lilac: t['accent-lilac'],
      peach: t['accent-peach'],
      lemon: t['accent-lemon'],
      coral: t['accent-coral'],
      aqua: t['accent-aqua'],
    },
    background: t.background,
    backgroundMuted: t['background-muted'],
    canvas: t.canvas,
    foreground: t.foreground,
    muted: t.muted,
    border: t.border,
    borderSubtle: t['border-subtle'],
    borderStrong: t['border-strong'],
    card: t.card,
    surface1: t['surface-1'],
    surface2: t['surface-2'],
    surfaceRaised: t['surface-raised'],
    surfaceTray: t['surface-tray'],
    danger: t.danger,
    warning: t.warning,
    success: t.success,
    income: t.income,
    expense: t.expense,
    transfer: t.transfer,
    states: {
      pending: t['state-pending'],
      attention: t['state-attention'],
      approved: t['state-approved'],
      destructive: t['state-destructive'],
    },
    chart: [
      t['chart-1'],
      t['chart-2'],
      t['chart-3'],
      t['chart-4'],
      t['chart-5'],
      t['chart-6'],
    ] as const,
    sand: t.sand,
    sandLight: t['sand-light'],
    hairline: t.hairline,
    track: t.track,
    ink2: t['ink-2'],
    inactive: t.inactive,
    tabBar: t['tab-bar'],
    onTabBar: t['on-tab-bar'],
    onPastel: t['on-pastel'],
    onCategory: t['on-category'],
    onMintKey: t['on-mint-key'],
    blockMint: t['block-mint'],
    blockLemon: t['block-lemon'],
    blockLilac: t['block-lilac'],
    blockPeach: t['block-peach'],
    deepMint: t['deep-mint'],
    mint: t.mint,
    mintKey: t['mint-key'],
    mintKeyPressed: t['mint-key-pressed'],
    lemon: t.lemon,
    lilac: t.lilac,
    peach: t.peach,
    coral: t.coral,
    sky: t.sky,
    aqua: t.aqua,
    over: t.over,
    primaryPressed: t['primary-pressed'],
    mintPressed: t['mint-pressed'],
    destructiveFill: t['destructive-fill'],
    destructivePressed: t['destructive-pressed'],
    moniGlyph: t['moni-glyph'],
    attentionFill: t['attention-fill'],
    pendingFill: t['pending-fill'],
    bloom: t.bloom,
    onInkPositive: t['on-ink-positive'],
    onLemon: t['on-lemon'],
    onLilac: t['on-lilac'],
    onMint: t['on-mint'],
    onInkMeta: t['on-ink-meta'],
    onInkBody: t['on-ink-body'],
  };
}

export type ThemeTokens = ReturnType<typeof buildThemeTokens>;

/** Outside the root provider (tests, isolated renders) every reader gets the light values. */
export const ThemeTokensContext = createContext<ThemeTokens>(buildThemeTokens([]));

/**
 * The one Uniwind subscription for the whole app, called by the root layout and handed down
 * through `ThemeTokensContext`. A theme change resolves the colours once, not once per reader.
 */
export function useResolvedThemeTokens(): ThemeTokens {
  const values = useCSSVariable(variableNames);
  return useMemo(() => buildThemeTokens(values), [values]);
}

/**
 * Resolved semantic colours for APIs that cannot accept Uniwind class names
 * (native icons, maps, SVG charts, navigation chrome, and gradients).
 */
export function useThemeTokens(): ThemeTokens {
  return use(ThemeTokensContext);
}
