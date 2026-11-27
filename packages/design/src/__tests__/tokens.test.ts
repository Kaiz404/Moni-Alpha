import { describe, expect, it } from 'vitest';

import { categoryColors } from '../categories';
import { colorRoleNames, darkColors, lightColors } from '../colors';
import { mobileGlobalCss, mobileThemeTokensTs, webTokensCss } from '../emit';
import { iconNames, mdiVersion } from '../icons.generated';
import { radii, spacing } from '../shape';
import { fontFaces, typeScale } from '../type';

describe('colour roles', () => {
  it('resolves the Cream canvas in light and the near-black ground in dark', () => {
    expect(lightColors.canvas).toBe('#f6f2e9');
    expect(darkColors.canvas).toBe('#0b0a09');
    expect(lightColors['block-mint']).toBe('#a9ddb5');
    expect(darkColors['on-category']).toBe('#17181a');
  });

  it('gives every role a value in both themes', () => {
    expect(colorRoleNames).toHaveLength(88);
    for (const name of colorRoleNames) {
      expect(lightColors[name]).toMatch(/^#[0-9a-f]{6}$/);
      expect(darkColors[name]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('category colours', () => {
  it('pairs each core colour with its preset, solid in both themes', () => {
    expect(categoryColors.mint).toEqual({ preset: 'Groceries', light: '#6fd08c', dark: '#59c97d' });
    expect(categoryColors.pink).toEqual({ preset: 'Health', light: '#ee8db8', dark: '#f07ab2' });
  });
});

describe('shape and type', () => {
  it('holds the v2 radii, spacing and faces', () => {
    expect(radii).toEqual({ card: 26, tile: 22, field: 16, sheet: 32 });
    expect(spacing.touch).toBe(44);
    expect(fontFaces['display-bold']).toEqual({ expo: 'FunnelDisplay_700Bold', weight: 700 });
    expect(typeScale.hero).toEqual({ face: 'display-bold', size: 64, line: 64, tracking: -0.03 });
  });
});

describe('icon names', () => {
  it('lists the glyphs the phone draws from MDI 7.4.47', () => {
    expect(mdiVersion).toBe('7.4.47');
    expect(iconNames).toContain('pencil-outline');
    expect(iconNames).toContain('silverware-fork-knife');
  });
});

describe('generated files', () => {
  it('writes the Uniwind theme and variant blocks for the phone', () => {
    const css = mobileGlobalCss();
    expect(css).toContain('  --font-display-bold: FunnelDisplay_700Bold;\n');
    expect(css).toContain('  --radius-card: 26px;\n');
    expect(css).toContain('    @variant light {\n      --color-background: #f6f2e9;\n');
    expect(css).toContain('    @variant dark {\n      --color-background: #0b0a09;\n');
    expect(css).toContain(
      '      /* Secondary text on a block. */\n      --color-on-lemon: #6b5410;\n',
    );
  });

  it('writes the colours useThemeTokens reads', () => {
    const ts = mobileThemeTokensTs();
    expect(ts).toContain("  canvas: '#f6f2e9',\n");
    expect(ts).toContain("  'ink-2': '#cec8bd',\n");
  });

  it('writes CSS variables for the web, dark by attribute or by system setting', () => {
    const css = webTokensCss();
    expect(css).toContain(
      ":root {\n  color-scheme: light;\n  --font-display: 'Funnel Display', system-ui, sans-serif;\n",
    );
    expect(css).toContain('  --text-caps--letter-spacing: 0.04em;\n');
    expect(css).toContain('  --duration-sheet: 434.5ms;\n');
    expect(css).toContain(
      "[data-theme='dark'] {\n  color-scheme: dark;\n  --color-background: #0b0a09;\n",
    );
    expect(css).toContain(
      "@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {\n    color-scheme: dark;\n    --color-background: #0b0a09;\n",
    );
  });
});
