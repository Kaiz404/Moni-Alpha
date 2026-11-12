import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { customCategoryColors, legacyColor, legacyColorMap } from '@repo/types';

import { WALLET_CARD_STYLES } from '@/constants/wallet-card-styles';

const sql = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20261112000000_current_plus_category_colors.sql'),
  'utf8',
);
const hexes = (text: string) => text.match(/#[0-9A-Fa-f]{6}/g) ?? [];

const migrationPairs = Object.fromEntries(
  [...sql.matchAll(/\('(#[0-9A-F]{6})',\s*'(#[0-9A-F]{6})'\)/g)].map((m) => [m[1], m[2]]),
);
const systemPalette = hexes(sql.match(/user_id IS NULL AND color = ANY \(ARRAY\[([^\]]*)\]/)![1]);

describe('legacy colour map', () => {
  it('maps every old hex into the new custom, system or wallet palette', () => {
    const allowed = new Set([
      ...customCategoryColors,
      ...systemPalette,
      ...WALLET_CARD_STYLES.map((style) => style.swatchHex),
    ]);
    for (const [old, next] of Object.entries(legacyColorMap)) {
      expect({ old, ok: allowed.has(next) }).toEqual({ old, ok: true });
    }
  });

  it('matches the migration pairs exactly', () => {
    expect(systemPalette).toHaveLength(18);
    expect(migrationPairs).toEqual(legacyColorMap);
  });

  it('rewrites an old hex and leaves a current one alone', () => {
    expect(legacyColor('#f2b8b5')).toBe('#FC7F78');
    expect(legacyColor('#FC7F78')).toBe('#FC7F78');
  });
});
