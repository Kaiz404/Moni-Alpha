/** A box in viewport pixels, as `getBoundingClientRect` gives it. */
export type Box = { left: number; top: number; width: number; height: number };

export type Side = 'bottom' | 'top';
export type Align = 'start' | 'end';

export type Placement = {
  left: number;
  top: number;
  /** Set only when neither side fits the whole popover, so it scrolls instead of leaving the screen. */
  maxHeight: number | null;
  side: Side;
  origin: string;
};

const GAP = 6;
const MARGIN = 8;

/** The part of `box` inside `bounds`. */
export function intersect(box: Box, bounds: Box): Box {
  const left = Math.max(box.left, bounds.left);
  const top = Math.max(box.top, bounds.top);
  const right = Math.min(box.left + box.width, bounds.left + bounds.width);
  const bottom = Math.min(box.top + box.height, bounds.top + bounds.height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Where a popover of `size` goes beside `anchor` so all of it stays inside `bounds`: on the preferred
 * side and edge, flipped to the other side or edge when that one has no room, then clamped.
 */
export function placeFloating(
  anchor: Box,
  size: { width: number; height: number },
  bounds: Box,
  prefer: { side?: Side; align?: Align } = {},
): Placement {
  const { side: wanted = 'bottom', align = 'start' } = prefer;
  const room: Record<Side, number> = {
    bottom: bounds.top + bounds.height - MARGIN - (anchor.top + anchor.height + GAP),
    top: anchor.top - GAP - (bounds.top + MARGIN),
  };
  const other: Side = wanted === 'bottom' ? 'top' : 'bottom';
  const side =
    size.height <= room[wanted]
      ? wanted
      : size.height <= room[other]
        ? other
        : room[wanted] >= room[other]
          ? wanted
          : other;
  const height = Math.min(size.height, Math.max(room[side], 0));
  const top = side === 'bottom' ? anchor.top + anchor.height + GAP : anchor.top - GAP - height;

  const minLeft = bounds.left + MARGIN;
  const maxLeft = bounds.left + bounds.width - MARGIN - size.width;
  const startLeft = anchor.left;
  const endLeft = anchor.left + anchor.width - size.width;
  const fits = (left: number) => left >= minLeft && left <= maxLeft;
  const [first, second] = align === 'start' ? [startLeft, endLeft] : [endLeft, startLeft];
  const left = fits(first)
    ? first
    : fits(second)
      ? second
      : Math.max(minLeft, Math.min(first, maxLeft));

  const fromLeft = left + size.width / 2 >= anchor.left + anchor.width / 2;
  return {
    left: Math.round(left),
    top: Math.round(top),
    maxHeight: height < size.height ? Math.floor(height) : null,
    side,
    origin: `${side === 'bottom' ? 'top' : 'bottom'} ${fromLeft ? 'left' : 'right'}`,
  };
}

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
