const DARK_GLYPH = '#17181A';
const LIGHT_GLYPH = '#F6F3ED';

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** The glyph colour for a stored category or wallet colour: light on dark fills, near-black otherwise. */
export function glyphOn(hex: string) {
  return luminance(hex) < 0.2 ? LIGHT_GLYPH : DARK_GLYPH;
}
