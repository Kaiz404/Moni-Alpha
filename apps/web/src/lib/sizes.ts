/**
 * The seams a viewer can drag (#95): each docked pane's width and the Activity table's columns. A size is
 * kept per browser, clamped to its span, and the default comes back on a double click.
 */
export type Span = { initial: number; min: number; max: number };

export const PANE_SPANS = {
  transaction: { initial: 380, min: 340, max: 720 },
  category: { initial: 408, min: 340, max: 720 },
  person: { initial: 408, min: 340, max: 720 },
  wallet: { initial: 408, min: 340, max: 720 },
  review: { initial: 520, min: 400, max: 820 },
  chat: { initial: 420, min: 360, max: 720 },
} as const satisfies Record<string, Span>;

export type PaneName = keyof typeof PANE_SPANS;

export const COLUMN_SPANS = {
  date: { initial: 84, min: 64, max: 180 },
  category: { initial: 150, min: 96, max: 320 },
  wallet: { initial: 116, min: 80, max: 260 },
  source: { initial: 112, min: 80, max: 220 },
  amount: { initial: 100, min: 80, max: 200 },
} as const satisfies Record<string, Span>;

export type ResizableColumn = keyof typeof COLUMN_SPANS;
export type ColumnWidths = Partial<Record<ResizableColumn, number>>;

/** One arrow press moves a seam 16 px, 64 with Shift. */
export const KEY_STEP = 16;

export function clampSize(span: Span, value: number): number {
  return Math.round(Math.min(span.max, Math.max(span.min, value)));
}

/** A stored width, or the default when it's missing or not a number. */
export function parseSize(span: Span, stored: string | null): number {
  const value = Number(stored);
  return stored !== null && stored !== '' && Number.isFinite(value) ? clampSize(span, value) : span.initial;
}

/** The columns stored as JSON; unknown keys and non-numbers drop out. */
export function parseColumnWidths(stored: string | null): ColumnWidths {
  let raw: unknown;
  try {
    raw = JSON.parse(stored ?? '{}');
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object') return {};
  const widths: ColumnWidths = {};
  for (const [key, span] of Object.entries(COLUMN_SPANS) as [ResizableColumn, Span][]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) widths[key] = clampSize(span, value);
  }
  return widths;
}

/**
 * What a key does to a focused seam. `grows` is the way the size grows: a pane's handle sits on its left
 * edge, so ArrowLeft widens it; a column's handle sits on its right edge, so ArrowRight widens it.
 */
export function sizeForKey(span: Span, value: number, key: string, shift: boolean, grows: 'left' | 'right'): number | null {
  const step = shift ? KEY_STEP * 4 : KEY_STEP;
  switch (key) {
    case 'ArrowLeft':
      return clampSize(span, value + (grows === 'left' ? step : -step));
    case 'ArrowRight':
      return clampSize(span, value + (grows === 'right' ? step : -step));
    case 'Home':
      return span.min;
    case 'End':
      return span.max;
    case 'Enter':
      return span.initial;
    default:
      return null;
  }
}

/** The size after dragging `dx` pixels from where the drag started. */
export function sizeForDrag(span: Span, start: number, dx: number, grows: 'left' | 'right'): number {
  return clampSize(span, start + (grows === 'left' ? -dx : dx));
}
