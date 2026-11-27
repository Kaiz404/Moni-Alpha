import { mdiHelpCircleOutline, mdiShapeOutline, mdiSilverwareForkKnife } from '@mdi/js';
import { categoryIconNames } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { glyphPath } from '../glyph-path';
import { GLYPHS } from '../glyphs.generated';

describe('glyphPath', () => {
  it('draws a category icon by its name', () => {
    expect(glyphPath('silverware-fork-knife')).toBe(mdiSilverwareForkKnife);
  });

  it('draws no category as the "?" bubble, never a dot', () => {
    expect(glyphPath(null)).toBe(mdiHelpCircleOutline);
    expect(glyphPath(undefined)).toBe(mdiHelpCircleOutline);
    expect(glyphPath('')).toBe(mdiHelpCircleOutline);
  });

  it('draws a name the web has no path for as a generic category shape', () => {
    expect(glyphPath('not-an-icon')).toBe(mdiShapeOutline);
  });

  it('has a path for every icon a category can carry', () => {
    expect(categoryIconNames.filter((name) => !GLYPHS[name])).toEqual([]);
  });
});
