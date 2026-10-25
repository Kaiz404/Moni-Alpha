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

function leafValues(value: unknown): unknown[] {
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(leafValues);
  }
  return [value];
}

describe('generated theme tokens', () => {
  it('copies the v2 Cream canvas and the V2F-Dark ground from global.css', () => {
    expect(variantBlock('light')).toContain('--color-canvas: #f6f2e9;');
    expect(variantBlock('dark')).toContain('--color-canvas: #161512;');
    expect(lightThemeTokens.canvas).toBe('#f6f2e9');
    expect(darkThemeTokens.canvas).toBe('#161512');
  });
});

describe('useThemeTokens', () => {
  it('reads every generated token exactly once', () => {
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map((name) => `--color-${name}`));
    const { result } = renderHook(() => useThemeTokens());

    expect(leafValues(result.current).sort()).toEqual(
      themeTokenNames.map((name) => `--color-${name}`).sort(),
    );
  });

  it('falls back to the v2 light values when Uniwind resolves nothing', () => {
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map(() => undefined));
    const { result } = renderHook(() => useThemeTokens());

    expect(result.current).toEqual({
      primary: '#17181a',
      primaryForeground: '#fffdf8',
      primaryMuted: '#d3eed9',
      accent: '#8ecf9d',
      accents: {
        lilac: '#c9b6f0',
        peach: '#f5be98',
        lemon: '#f2dc72',
        coral: '#f1a399',
        aqua: '#9fdcd3',
      },
      background: '#f6f2e9',
      backgroundMuted: '#ece5d6',
      canvas: '#f6f2e9',
      foreground: '#17181a',
      muted: '#6b665c',
      border: '#ddd5c5',
      borderSubtle: '#efe8da',
      borderStrong: '#b9b0a0',
      card: '#fffdf8',
      surface1: '#fffdf8',
      surface2: '#ece5d6',
      surfaceRaised: '#fffdf8',
      surfaceTray: '#efe8da',
      danger: '#b23e35',
      warning: '#6b5410',
      success: '#236b47',
      income: '#236b47',
      expense: '#17181a',
      transfer: '#6b665c',
      states: {
        pending: '#3e3654',
        attention: '#6b5410',
        approved: '#174831',
        destructive: '#8e2f28',
      },
      chart: ['#a9ddb5', '#9fc4e8', '#c9b6f0', '#f2dc72', '#f1a399', '#f5be98'],
      sand: '#ece5d6',
      sandLight: '#efe8da',
      hairline: '#ddd5c5',
      track: '#ece5d6',
      ink2: '#4a463e',
      inactive: '#a9a397',
      tabBar: '#17181a',
      onTabBar: '#fffdf8',
      onPastel: '#17181a',
      deepMint: '#236b47',
      mint: '#a9ddb5',
      mintKey: '#8ecf9d',
      mintKeyPressed: '#7dc48d',
      lemon: '#f2dc72',
      lilac: '#c9b6f0',
      peach: '#f5be98',
      coral: '#f1a399',
      sky: '#9fc4e8',
      aqua: '#9fdcd3',
      over: '#b23e35',
      primaryPressed: '#2e2f33',
      mintPressed: '#9ad3a8',
      destructiveFill: '#f9d5d0',
      destructivePressed: '#f3c3bc',
      moniGlyph: '#c9b6f0',
      attentionFill: '#f8edb8',
      pendingFill: '#e4daf6',
      bloom: '#e3d8c2',
      onInkPositive: '#a9ddb5',
      onLemon: '#6b5410',
      onLilac: '#3e3654',
      onMint: '#174831',
      onInkMeta: '#a9a397',
      onInkBody: '#efe8da',
    });
  });

  it('returns the resolved dark values when Uniwind resolves them', () => {
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map((name) => darkThemeTokens[name]));
    const { result } = renderHook(() => useThemeTokens());

    expect(result.current.canvas).toBe('#161512');
    expect(result.current.card).toBe('#211f1b');
    expect(result.current.foreground).toBe('#f3eee3');
    expect(result.current.primary).toBe('#ede6d8');
    expect(result.current.onPastel).toBe('#17181a');
    expect(result.current.tabBar).toBe('#2a2823');
    expect(result.current.states.pending).toBe('#cfbff3');
    expect(result.current.chart).toEqual([
      '#8fc79d',
      '#86aed6',
      '#b29de0',
      '#e0c85e',
      '#de8b80',
      '#e3a47e',
    ]);
  });
});
