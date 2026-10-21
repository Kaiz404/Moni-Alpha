import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderHook } from '@testing-library/react-native';
import { useCSSVariable } from 'uniwind';

import {
  darkThemeTokens,
  lightThemeTokens,
  themeTokenNames,
} from '@/constants/theme-tokens.generated';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

jest.mock('uniwind', () => ({ useCSSVariable: jest.fn() }));

const mockedUseCSSVariable = jest.mocked(useCSSVariable);

const globalCss = readFileSync(join(__dirname, '../../../global.css'), 'utf8');

function variantBlock(variant: 'light' | 'dark') {
  const start = globalCss.indexOf(`@variant ${variant} {`);
  return globalCss.slice(start, globalCss.indexOf('}', start));
}

const v1HookNames = [
  'primary',
  'primary-soft',
  'primary-foreground',
  'primary-muted',
  'accent',
  'accent-lilac',
  'accent-peach',
  'accent-lemon',
  'accent-coral',
  'accent-aqua',
  'background',
  'canvas',
  'foreground',
  'muted',
  'muted-strong',
  'inverse',
  'border',
  'border-subtle',
  'border-strong',
  'card',
  'surface-1',
  'surface-2',
  'surface-raised',
  'surface-tray',
  'danger',
  'warning',
  'success',
  'income',
  'expense',
  'transfer',
  'state-pending',
  'state-attention',
  'state-approved',
  'state-destructive',
  'category-food',
  'category-transport',
  'category-shopping',
  'category-home',
  'category-health',
  'category-entertainment',
  'category-income',
  'category-other',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
];

describe('generated theme tokens', () => {
  it('copies canvas from both global.css variants', () => {
    expect(variantBlock('light')).toContain('--color-canvas: #f7f7f2;');
    expect(variantBlock('dark')).toContain('--color-canvas: #141513;');
    expect(lightThemeTokens.canvas).toBe('#f7f7f2');
    expect(darkThemeTokens.canvas).toBe('#141513');
  });

  it('names every token the v1 hook read, plus the three it skipped', () => {
    expect(themeTokenNames).toEqual(expect.arrayContaining(v1HookNames));
    expect(themeTokenNames.filter((name) => !v1HookNames.includes(name))).toEqual([
      'background-muted',
      'brand-mint',
      'brand-mint-ink',
    ]);
    expect(themeTokenNames).toHaveLength(v1HookNames.length + 3);
  });
});

describe('useThemeTokens', () => {
  it('falls back to the v1 light values when Uniwind resolves nothing', () => {
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map(() => undefined));
    const { result } = renderHook(() => useThemeTokens());

    expect(result.current).toEqual({
      primary: '#236b47',
      primarySoft: '#8ecf9d',
      primaryForeground: '#ffffff',
      primaryMuted: '#c8e6d4',
      accent: '#8ecf9d',
      accents: {
        lilac: '#b39ae8',
        peach: '#f0ad85',
        lemon: '#e8cf50',
        coral: '#e87d72',
        aqua: '#72cec4',
      },
      background: '#ffffff',
      canvas: '#f7f7f2',
      foreground: '#1e211e',
      muted: '#60665e',
      mutedStrong: '#454b44',
      inverse: '#f7f7f2',
      border: '#dee1d9',
      borderSubtle: '#e9ebe5',
      borderStrong: '#c9cdc3',
      card: '#ffffff',
      surface1: '#ffffff',
      surface2: '#e5e9dc',
      surfaceRaised: '#ffffff',
      surfaceTray: '#c8e6d4',
      danger: '#b9413d',
      warning: '#8a5b13',
      success: '#236b47',
      income: '#236b47',
      expense: '#b9413d',
      transfer: '#277b85',
      states: {
        pending: '#7660ad',
        attention: '#8a5b13',
        approved: '#236b47',
        destructive: '#b9413d',
      },
      category: {
        food: '#d46f64',
        transport: '#4f9a92',
        shopping: '#9a7fd1',
        home: '#d59a45',
        health: '#61a777',
        entertainment: '#b67eaa',
        income: '#438e5a',
        other: '#7b8179',
      },
      chart: ['#438e5a', '#4f9a92', '#9a7fd1', '#d59a45', '#d46f64', '#b67eaa'],
    });
  });

  it('returns the resolved dark values when Uniwind resolves them', () => {
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map((name) => darkThemeTokens[name]));
    const { result } = renderHook(() => useThemeTokens());

    expect(result.current.canvas).toBe('#141513');
    expect(result.current.primary).toBe('#a9e8b5');
    expect(result.current.states.pending).toBe('#c8b8f4');
    expect(result.current.category.food).toBe('#ec9c92');
    expect(result.current.chart).toEqual([
      '#a9e8b5',
      '#8fd2ca',
      '#c7b4f0',
      '#e9bd6b',
      '#ec9c92',
      '#d5a6cb',
    ]);
  });
});
