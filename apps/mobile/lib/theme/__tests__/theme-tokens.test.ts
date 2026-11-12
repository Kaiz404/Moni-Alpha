import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { useCSSVariable } from 'uniwind';

import {
  darkThemeTokens,
  lightThemeTokens,
  themeTokenNames,
} from '@/constants/theme-tokens.generated';
import {
  ThemeTokensContext,
  useResolvedThemeTokens,
  useThemeTokens,
} from '@/hooks/use-theme-tokens';

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
  it('copies the v2 Cream canvas and the near-black V2F-Dark ground from global.css', () => {
    expect(variantBlock('light')).toContain('--color-canvas: #f6f2e9;');
    expect(variantBlock('dark')).toContain('--color-canvas: #0b0a09;');
    expect(lightThemeTokens.canvas).toBe('#f6f2e9');
    expect(darkThemeTokens.canvas).toBe('#0b0a09');
  });
});

describe('useResolvedThemeTokens', () => {
  it('reads every generated token exactly once', () => {
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map((name) => `--color-${name}`));
    const { result } = renderHook(() => useResolvedThemeTokens());

    expect(leafValues(result.current).sort()).toEqual(
      themeTokenNames.map((name) => `--color-${name}`).sort(),
    );
  });

  it('falls back to the v2 light values when Uniwind resolves nothing', () => {
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map(() => undefined));
    const { result } = renderHook(() => useResolvedThemeTokens());

    expect(result.current).toEqual({
      primary: '#17181a',
      primaryForeground: '#fffdf8',
      primaryMuted: '#d3eed9',
      accent: '#8ecf9d',
      accents: {
        lilac: '#a98cf5',
        peach: '#ff9f66',
        lemon: '#f7cf3a',
        coral: '#ff7f70',
        aqua: '#4cc8ba',
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
      chart: ['#6fd08c', '#62a8ee', '#a98cf5', '#f7cf3a', '#ff7f70', '#ff9f66'],
      sand: '#ece5d6',
      sandLight: '#efe8da',
      hairline: '#ddd5c5',
      track: '#ece5d6',
      ink2: '#4a463e',
      inactive: '#a9a397',
      tabBar: '#17181a',
      onTabBar: '#fffdf8',
      onPastel: '#17181a',
      onCategory: '#17181a',
      onMintKey: '#17181a',
      blockMint: '#a9ddb5',
      blockLemon: '#f2dc72',
      blockLilac: '#c9b6f0',
      blockPeach: '#f5be98',
      deepMint: '#236b47',
      mint: '#6fd08c',
      mintKey: '#8ecf9d',
      mintKeyPressed: '#7dc48d',
      lemon: '#f7cf3a',
      lilac: '#a98cf5',
      peach: '#ff9f66',
      coral: '#ff7f70',
      sky: '#62a8ee',
      aqua: '#4cc8ba',
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
    const { result } = renderHook(() => useResolvedThemeTokens());

    expect(result.current.canvas).toBe('#0b0a09');
    expect(result.current.card).toBe('#1d1b19');
    expect(result.current.foreground).toBe('#f6f3ed');
    expect(result.current.primary).toBe('#f6f3ed');
    expect(result.current.onPastel).toBe('#f6f3ed');
    expect(result.current.onCategory).toBe('#17181a');
    expect(result.current.blockMint).toBe('#123422');
    expect(result.current.tabBar).toBe('#242220');
    expect(result.current.states.pending).toBe('#c9b7ff');
    expect(result.current.chart).toEqual([
      '#59c97d',
      '#4ca4f5',
      '#987aff',
      '#f0c42c',
      '#f5685a',
      '#f58d47',
    ]);
  });
});

describe('useThemeTokens', () => {
  it('reads the colours the root resolved, without its own Uniwind subscription', () => {
    mockedUseCSSVariable.mockClear();
    mockedUseCSSVariable.mockReturnValue(themeTokenNames.map((name) => darkThemeTokens[name]));
    const root = renderHook(() => useResolvedThemeTokens()).result.current;
    mockedUseCSSVariable.mockClear();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ThemeTokensContext, { value: root }, children);
    const { result } = renderHook(() => useThemeTokens(), { wrapper });

    expect(result.current.canvas).toBe('#0b0a09');
    expect(result.current).toBe(root);
    expect(mockedUseCSSVariable).not.toHaveBeenCalled();
  });

  it('gives the light values outside the root provider', () => {
    const { result } = renderHook(() => useThemeTokens());

    expect(result.current.canvas).toBe('#f6f2e9');
    expect(result.current.foreground).toBe('#17181a');
  });

  it('keeps the same object across renders while the theme holds', () => {
    const values = themeTokenNames.map((name) => darkThemeTokens[name]);
    mockedUseCSSVariable.mockReturnValue(values);
    const { result, rerender } = renderHook(() => useResolvedThemeTokens());
    const before = result.current;
    rerender({});

    expect(result.current).toBe(before);
  });
});
