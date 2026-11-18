/**
 * The shell's four layouts, chosen by the viewport (W2-Responsive): never by the device or the user agent.
 * The CSS that shows and hides each part is generated from this table, so the media queries and
 * `layoutFor` can't disagree.
 */
export type LayoutKind = 'phone' | 'rail-one-column' | 'rail' | 'sidebar';

export const PHONE_MAX_WIDTH = 700;
export const ONE_COLUMN_MAX_WIDTH = 1024;
export const RAIL_MAX_WIDTH = 1360;
export const PHONE_MAX_HEIGHT = 500;

export function layoutFor(width: number, height: number): LayoutKind {
  if (width < PHONE_MAX_WIDTH || height < PHONE_MAX_HEIGHT) return 'phone';
  if (width < ONE_COLUMN_MAX_WIDTH) return 'rail-one-column';
  if (width < RAIL_MAX_WIDTH) return 'rail';
  return 'sidebar';
}

const below = (px: number) => `${px - 0.02}px`;
const TALL = `(min-height: ${PHONE_MAX_HEIGHT}px)`;

export const LAYOUT_QUERIES: Record<LayoutKind, string> = {
  phone: `(max-width: ${below(PHONE_MAX_WIDTH)}), (max-height: ${below(PHONE_MAX_HEIGHT)})`,
  'rail-one-column': `(min-width: ${PHONE_MAX_WIDTH}px) and (max-width: ${below(ONE_COLUMN_MAX_WIDTH)}) and ${TALL}`,
  rail: `(min-width: ${ONE_COLUMN_MAX_WIDTH}px) and (max-width: ${below(RAIL_MAX_WIDTH)}) and ${TALL}`,
  sidebar: `(min-width: ${RAIL_MAX_WIDTH}px) and ${TALL}`,
};

/** Where the page's content starts from the left edge, in px, beside the sidebar or rail. */
export const CONTENT_LEFT: Record<LayoutKind, number> = {
  phone: 0,
  'rail-one-column': 120,
  rail: 120,
  sidebar: 284,
};

export const LAYOUT_KINDS = Object.keys(LAYOUT_QUERIES) as LayoutKind[];

/**
 * One rule per layout: parts marked `data-only="sidebar rail"` show only in those layouts, and the
 * root carries `--layout` (read by the verify script) and `--content-left`.
 */
export function layoutCss(): string {
  return LAYOUT_KINDS.map(
    (kind) =>
      `@media ${LAYOUT_QUERIES[kind]}{:root{--layout:${kind};--content-left:${CONTENT_LEFT[kind]}px}` +
      `[data-only]:not([data-only~="${kind}"]){display:none!important}}`,
  ).join('\n');
}

/**
 * Runs before first paint and on every resize: puts the current layout on <html data-layout>, for
 * styles that differ by layout and for the verify script.
 */
export const LAYOUT_SCRIPT = `(function(){var q=${JSON.stringify(LAYOUT_QUERIES)};function s(){for(var k in q)if(matchMedia(q[k]).matches){document.documentElement.dataset.layout=k;return}}s();addEventListener('resize',s)})()`;
