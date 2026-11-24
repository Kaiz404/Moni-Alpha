/** Which side of its anchor a popover opens on; ui-sdk flips it when there is no room. */
export type Side = 'bottom' | 'top';
export type Align = 'start' | 'end';

/** How long a pause starts a new type-ahead search, as a native select does. */
export const TYPE_AHEAD_MS = 700;

/**
 * The row a native select's type-ahead lands on: the first label from the focused row on that starts
 * with `typed`, or, while one letter is typed again and again, the next row starting with it.
 * -1 when none does.
 */
export function typeAheadIndex(labels: readonly string[], at: number, typed: string): number {
  const text = typed.toLowerCase();
  const cycling = [...text].every((letter) => letter === text[0]);
  const query = cycling ? text.slice(0, 1) : text;
  const start = cycling ? at + 1 : Math.max(at, 0);
  for (let step = 0; step < labels.length; step++) {
    const index = (start + step) % labels.length;
    if (labels[index]!.trim().toLowerCase().startsWith(query)) return index;
  }
  return -1;
}
