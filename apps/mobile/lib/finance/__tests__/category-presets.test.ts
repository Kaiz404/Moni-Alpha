import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { categoryIconNames, customCategoryColors } from '@repo/types';

import { hideShadowedPresets, type CategoryIdentity } from '../category-presets';

const row = (over: Partial<CategoryIdentity>): CategoryIdentity => ({
  userId: null,
  name: 'Tolls',
  type: 'expense',
  isActive: true,
  ...over,
});

const names = (rows: CategoryIdentity[]) =>
  hideShadowedPresets(rows, (category) => category).map((c) => `${c.userId ?? 'preset'}:${c.name}`);

describe('hideShadowedPresets', () => {
  it('keeps the category a user already made and hides the preset with its name', () => {
    expect(names([row({}), row({ userId: 'me', name: 'tolls ' }), row({ name: 'Transit' })])).toEqual([
      'me:tolls ',
      'preset:Transit',
    ]);
  });

  it('shows the preset once the user archived theirs', () => {
    expect(names([row({}), row({ userId: 'me', isActive: false })])).toEqual(['preset:Tolls', 'me:Tolls']);
  });

  it('compares within a type', () => {
    expect(names([row({ type: 'income' }), row({ userId: 'me' })])).toEqual([
      'preset:Tolls',
      'me:Tolls',
    ]);
  });
});

describe('the Malaysian presets migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../../../../supabase/migrations/20261101000100_malaysian_categories.sql'),
    'utf8',
  );
  const presets = [...sql.matchAll(/\('([^']+)', '([a-z-]+)', '(#[0-9A-F]{6})', (\d+)\)/g)].map(
    ([, name, icon, color, order]) => ({ name, icon, color, order: Number(order) }),
  );

  it('adds the five names, each fitting the name limit, in order before Other Expenses', () => {
    expect(presets.map((p) => p.name)).toEqual(['Transit', 'Tolls', 'TNG Reloads', 'PTPTN', 'Takaful']);
    expect(presets.every((p) => p.name.length <= 20)).toBe(true);
    expect(presets.map((p) => p.order)).toEqual([13, 14, 15, 16, 17]);
  });

  it('uses only icons the schema and the database accept', () => {
    const allowed = sql.slice(sql.indexOf('ARRAY['), sql.indexOf(']));'));
    for (const icon of categoryIconNames) expect(allowed).toContain(`'${icon}'`);
    for (const preset of presets) expect(categoryIconNames).toContain(preset.icon);
  });

  it("uses colours from the preset palette and writes to no user's row", () => {
    const palette = readFileSync(
      join(__dirname, '../../../../../supabase/migrations/20260721000000_refresh_category_catalog.sql'),
      'utf8',
    ).match(/user_id IS NULL AND color = ANY \(ARRAY\[([^\]]+)\]/)![1]!;
    for (const preset of presets) expect(palette).toContain(preset.color);
    expect(customCategoryColors.length).toBeGreaterThan(0);
    expect(sql.match(/UPDATE public\.categories[\s\S]*?;/g)).toEqual([
      expect.stringContaining('WHERE user_id IS NULL'),
    ]);
  });
});
