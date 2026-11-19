import { describe, expect, it } from 'vitest';
import { LAYOUT_QUERIES, layoutCss, layoutFor } from '../layout';

describe('layoutFor', () => {
  it.each([
    [1440, 900, 'sidebar'],
    [1360, 768, 'sidebar'],
    [1359, 900, 'rail'],
    [1024, 768, 'rail'],
    [1023, 768, 'rail-one-column'],
    [820, 1180, 'rail-one-column'],
    [700, 900, 'rail-one-column'],
    [699, 900, 'phone'],
    [390, 844, 'phone'],
    [844, 390, 'phone'],
    [1440, 499, 'phone'],
    [1440, 500, 'sidebar'],
  ])('%i x %i is %s', (width, height, expected) => {
    expect(layoutFor(width, height)).toBe(expected);
  });

  it.each([
    [1440, 900, 'rail'],
    [1200, 900, 'rail'],
    [820, 1180, 'rail-one-column'],
    [390, 844, 'phone'],
  ])('%i x %i with the sidebar folded is %s', (width, height, expected) => {
    expect(layoutFor(width, height, true)).toBe(expected);
  });
});

describe('LAYOUT_QUERIES', () => {
  it('match the breakpoints layoutFor uses', () => {
    expect(LAYOUT_QUERIES).toEqual({
      phone: '(max-width: 699.98px), (max-height: 499.98px)',
      'rail-one-column': '(min-width: 700px) and (max-width: 1023.98px) and (min-height: 500px)',
      rail: '(min-width: 1024px) and (max-width: 1359.98px) and (min-height: 500px)',
      sidebar: '(min-width: 1360px) and (min-height: 500px)',
    });
  });
});

describe('layoutCss', () => {
  it('hides parts outside their layouts and the fold button where nothing folds', () => {
    expect(layoutCss().split('\n')[2]).toBe(
      '@media (min-width: 1024px) and (max-width: 1359.98px) and (min-height: 500px){:root{--layout:rail;--content-left:120px}' +
        ':root [data-only]:not([data-only~="rail"]){display:none!important}[data-fold]{display:none!important}}',
    );
  });

  it('shows the rail at sidebar widths while the sidebar is folded', () => {
    expect(layoutCss().split('\n')[3]).toBe(
      '@media (min-width: 1360px) and (min-height: 500px)' +
        '{:root:not([data-nav-folded]){--layout:sidebar;--content-left:284px}' +
        ':root:not([data-nav-folded]) [data-only]:not([data-only~="sidebar"]){display:none!important}' +
        ':root[data-nav-folded]{--layout:rail;--content-left:120px}' +
        ':root[data-nav-folded] [data-only]:not([data-only~="rail"]){display:none!important}}',
    );
  });
});
