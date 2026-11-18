import { darkColors, lightColors } from './colors';

/**
 * The core category colours (the chart set) and the preset each one dresses, light and dark. A
 * category bubble wears its colour solid with an Ink glyph in both themes; the same colour draws its
 * ring arc, bars and chart marks. The stored catalogue users pick from is `customCategoryColors` in
 * `@repo/types`.
 */
export const categoryColors = {
  mint: { preset: 'Groceries', light: lightColors.mint, dark: darkColors.mint },
  lemon: { preset: 'Subscriptions', light: lightColors.lemon, dark: darkColors.lemon },
  lilac: { preset: 'Entertainment', light: lightColors.lilac, dark: darkColors.lilac },
  peach: { preset: 'Shopping', light: lightColors.peach, dark: darkColors.peach },
  coral: { preset: 'Food', light: lightColors.coral, dark: darkColors.coral },
  sky: { preset: 'Transport', light: lightColors.sky, dark: darkColors.sky },
  aqua: { preset: 'Housing', light: lightColors.aqua, dark: darkColors.aqua },
  pink: { preset: 'Health', light: '#ee8db8', dark: '#f07ab2' },
  other: { preset: 'Other', light: '#cfc6b5', dark: '#8c867b' },
} as const;

export type CategoryColor = keyof typeof categoryColors;
