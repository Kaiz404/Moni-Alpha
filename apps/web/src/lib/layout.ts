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

/**
 * What a layout becomes while the user has folded the sidebar (#91). Only the sidebar folds; narrower
 * windows already show the rail.
 */
export const FOLDS_TO: Partial<Record<LayoutKind, LayoutKind>> = { sidebar: 'rail' };

/** On <html> while the sidebar is folded; the pre-paint script sets it from `NAV_FOLDED_KEY`. */
export const NAV_FOLDED_ATTR = 'data-nav-folded';
export const NAV_FOLDED_KEY = 'moni-nav-folded';

export function layoutFor(width: number, height: number, folded = false): LayoutKind {
  const kind: LayoutKind =
    width < PHONE_MAX_WIDTH || height < PHONE_MAX_HEIGHT
      ? 'phone'
      : width < ONE_COLUMN_MAX_WIDTH
        ? 'rail-one-column'
        : width < RAIL_MAX_WIDTH
          ? 'rail'
          : 'sidebar';
  return folded ? (FOLDS_TO[kind] ?? kind) : kind;
}

const below = (px: number) => `${px - 0.02}px`;
const TALL = `(min-height: ${PHONE_MAX_HEIGHT}px)`;

export const LAYOUT_QUERIES: Record<LayoutKind, string> = {
  phone: `(max-width: ${below(PHONE_MAX_WIDTH)}), (max-height: ${below(PHONE_MAX_HEIGHT)})`,
  'rail-one-column': `(min-width: ${PHONE_MAX_WIDTH}px) and (max-width: ${below(ONE_COLUMN_MAX_WIDTH)}) and ${TALL}`,
  rail: `(min-width: ${ONE_COLUMN_MAX_WIDTH}px) and (max-width: ${below(RAIL_MAX_WIDTH)}) and ${TALL}`,
  sidebar: `(min-width: ${RAIL_MAX_WIDTH}px) and ${TALL}`,
};

/** Narrower than this a docked pane opens over the page with a scrim (side-pane.css), not beside it. */
export const PANE_DOCKS_MIN_WIDTH = 1240;

/** The viewports where a docked pane covers the page: over it with a scrim, or the phone's pushed page. */
export const PANE_COVERS_QUERY = `(max-width: ${below(PANE_DOCKS_MIN_WIDTH)}), (max-height: ${below(PHONE_MAX_HEIGHT)})`;

/** Where the page's content starts from the left edge, in px, beside the sidebar or rail. */
export const CONTENT_LEFT: Record<LayoutKind, number> = {
  phone: 0,
  'rail-one-column': 120,
  rail: 120,
  sidebar: 284,
};

export const LAYOUT_KINDS = Object.keys(LAYOUT_QUERIES) as LayoutKind[];

function shows(kind: LayoutKind, root: string): string {
  return (
    `${root}{--layout:${kind};--content-left:${CONTENT_LEFT[kind]}px}` +
    `${root} [data-only]:not([data-only~="${kind}"]){display:none!important}`
  );
}

/**
 * One rule per layout: parts marked `data-only="sidebar rail"` show only in those layouts, and the
 * root carries `--layout` (read by the verify script) and `--content-left`. A layout that folds has a
 * second rule under the folded attribute, and parts marked `data-fold` (the fold button) show only there.
 */
export function layoutCss(): string {
  return LAYOUT_KINDS.map((kind) => {
    const folded = FOLDS_TO[kind];
    const rules = folded
      ? shows(kind, `:root:not([${NAV_FOLDED_ATTR}])`) + shows(folded, `:root[${NAV_FOLDED_ATTR}]`)
      : shows(kind, ':root') + '[data-fold]{display:none!important}';
    return `@media ${LAYOUT_QUERIES[kind]}{${rules}}`;
  }).join('\n');
}

/**
 * Runs before first paint, on every resize and on `moni-layout`: reads the fold from storage on first
 * run, then puts the current layout on <html data-layout>, for styles that differ by layout and for the
 * verify script.
 */
export const LAYOUT_SCRIPT = `(function(){var q=${JSON.stringify(LAYOUT_QUERIES)},f=${JSON.stringify(FOLDS_TO)},r=document.documentElement;try{if(localStorage.getItem('${NAV_FOLDED_KEY}')==='1')r.setAttribute('${NAV_FOLDED_ATTR}','')}catch(e){}function s(){for(var k in q)if(matchMedia(q[k]).matches){r.dataset.layout=r.hasAttribute('${NAV_FOLDED_ATTR}')&&f[k]||k;return}}s();addEventListener('resize',s);addEventListener('moni-layout',s)})()`;
