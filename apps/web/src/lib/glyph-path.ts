import { noCategoryIcon } from '@repo/types';
import { GLYPHS } from './glyphs.generated';

/** What a category icon the web has no path for draws: still a category, never a dot. */
export const UNKNOWN_GLYPH = 'shape-outline';

/** The path for an MDI name a row carries as data. No name is no category, the phone's "?" bubble. */
export function glyphPath(name: string | null | undefined): string {
  if (!name) return GLYPHS[noCategoryIcon]!;
  return GLYPHS[name] ?? GLYPHS[UNKNOWN_GLYPH]!;
}
