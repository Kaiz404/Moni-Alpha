import { textNamesPhrase } from './institutions';

/**
 * Malaysian merchants whose category Moni can name before the user has filed one. A prefill only:
 * the capture still goes to Review, and the user's own history wins over this.
 */
export const CATEGORY_HINTS: readonly { category: string; names: readonly string[] }[] = [
  {
    category: 'Tolls',
    names: ['toll', 'tol', 'smarttag', 'plus malaysia', 'plus expressway', 'lekas', 'besraya', 'litrak', 'kesas', 'penang bridge'],
  },
  {
    category: 'Transit',
    names: ['rapidkl', 'rapid kl', 'rapid rail', 'rapid bus', 'rapid penang', 'prasarana', 'mrt', 'lrt', 'ktm', 'ktm komuter', 'ets', 'erl', 'klia ekspres', 'monorail', 'mybas'],
  },
];

const hintFor = (text: string) =>
  CATEGORY_HINTS.find((hint) => hint.names.some((name) => textNamesPhrase(text, name)));

/** The active expense category an alert or a capture's merchant points at, or null. */
export function categoryFromHints(
  texts: readonly (string | null | undefined)[],
  categories: readonly { id: string; name: string | null; type: string | null; isActive: boolean }[],
): string | null {
  const hint = hintFor(texts.filter(Boolean).join(' '));
  if (!hint) return null;
  const wanted = hint.category.toLocaleLowerCase();
  return (
    categories.find(
      (category) =>
        category.isActive &&
        category.type === 'expense' &&
        category.name?.trim().toLocaleLowerCase() === wanted,
    )?.id ?? null
  );
}
