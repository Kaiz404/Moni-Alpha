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
    primarySoft: t['primary-soft'],
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
    canvas: t.canvas,
    foreground: t.foreground,
    muted: t.muted,
    mutedStrong: t['muted-strong'],
    inverse: t.inverse,
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
    category: {
      food: t['category-food'],
      transport: t['category-transport'],
      shopping: t['category-shopping'],
      home: t['category-home'],
      health: t['category-health'],
      entertainment: t['category-entertainment'],
      income: t['category-income'],
      other: t['category-other'],
    },
    chart: [
      t['chart-1'],
      t['chart-2'],
      t['chart-3'],
      t['chart-4'],
      t['chart-5'],
      t['chart-6'],
    ] as const,
  };
}
