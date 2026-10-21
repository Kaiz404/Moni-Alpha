import { useCSSVariable } from 'uniwind';

import { lightThemeTokens, themeTokenNames } from '@/constants/theme-tokens.generated';

const variableNames = themeTokenNames.map((name) => `--color-${name}`);

/**
 * Resolved semantic colours for APIs that cannot accept Uniwind class names
 * (native icons, maps, SVG charts, navigation chrome, and gradients).
 */
export function useThemeTokens() {
  const values = useCSSVariable(variableNames);
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
  };
}
