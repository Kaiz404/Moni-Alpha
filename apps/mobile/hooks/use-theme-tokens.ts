import { useCSSVariable } from 'uniwind';
import { ThemeFallbacks } from '@/constants/theme';

function asColor(value: string | number | undefined, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  return fallback;
}

/**
 * Theme colors for native APIs that need a hex/rgb string
 * (ActivityIndicator, tab bar, Victory charts, map pins, icon `color` props).
 */
export function useThemeTokens() {
  const [
    primary,
    primarySoft,
    primaryForeground,
    accent,
    background,
    foreground,
    muted,
    border,
    danger,
    income,
    expense,
    transfer,
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
    chart6,
  ] = useCSSVariable([
    '--color-primary',
    '--color-primary-soft',
    '--color-primary-foreground',
    '--color-accent',
    '--color-background',
    '--color-foreground',
    '--color-muted',
    '--color-border',
    '--color-danger',
    '--color-income',
    '--color-expense',
    '--color-transfer',
    '--color-chart-1',
    '--color-chart-2',
    '--color-chart-3',
    '--color-chart-4',
    '--color-chart-5',
    '--color-chart-6',
  ]);

  return {
    primary: asColor(primary, ThemeFallbacks.primary),
    primarySoft: asColor(primarySoft, ThemeFallbacks.primarySoft),
    primaryForeground: asColor(primaryForeground, ThemeFallbacks.primaryForeground),
    accent: asColor(accent, ThemeFallbacks.accent),
    background: asColor(background, ThemeFallbacks.background),
    foreground: asColor(foreground, ThemeFallbacks.foreground),
    muted: asColor(muted, ThemeFallbacks.muted),
    border: asColor(border, ThemeFallbacks.border),
    danger: asColor(danger, ThemeFallbacks.danger),
    income: asColor(income, ThemeFallbacks.income),
    expense: asColor(expense, ThemeFallbacks.expense),
    transfer: asColor(transfer, ThemeFallbacks.transfer),
    chart: [
      asColor(chart1, ThemeFallbacks.chart[0]),
      asColor(chart2, ThemeFallbacks.chart[1]),
      asColor(chart3, ThemeFallbacks.chart[2]),
      asColor(chart4, ThemeFallbacks.chart[3]),
      asColor(chart5, ThemeFallbacks.chart[4]),
      asColor(chart6, ThemeFallbacks.chart[5]),
    ] as const,
  };
}
