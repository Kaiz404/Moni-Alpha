import { placeDays, type Place } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
  centreOn,
  clearOfFloats,
  pinClear,
  FIT,
  flingSpeed,
  heatSize,
  hotSpot,
  panView,
  pinchView,
  pinWidth,
  visitColumns,
  placeMeta,
  placeSub,
  readPlacesQuery,
  sortPlaces,
  toView,
  viewForPick,
  wheelFactor,
  wheelGlides,
  zoomLimits,
  zoomView,
} from '../places-view';

const place = (id: string, name: string, total: number, count: number, categories: (string | null)[] = ['food'], area: string | null = 'Kuala Lumpur'): Place => ({
  id,
  name,
  area,
  latitude: 3.13,
  longitude: 101.67,
  totalMinor: total as MinorAmount,
  count,
  days: count,
  categories: categories.map((categoryId) => ({ categoryId, totalMinor: 0 as MinorAmount })),
  transactions: [],
});

const bangsar = place('b', 'Bangsar', 29380, 6, ['groceries', 'food']);
const midValley = place('m', 'Mid Valley', 24110, 4, ['shopping', 'food', 'groceries', 'health']);
const klcc = place('k', 'KLCC', 4190, 7);
const names: Record<string, string> = { groceries: 'Groceries', food: 'Food & Dining', shopping: 'Shopping', health: 'Health' };
const box = { width: 800, height: 600 };

describe('readPlacesQuery', () => {
  it('reads the URL, with Last 30 days, Pins and Spent when it says nothing', () => {
    expect(readPlacesQuery(new URLSearchParams(''))).toEqual({ range: '30d', categoryId: null, walletId: null, view: 'pins', layer: 'map', sort: 'spent', placeId: null });
    expect(readPlacesQuery(new URLSearchParams('range=7d&category=food&wallet=w1&view=heat&sort=visits&layer=satellite&place=3.1300,101.6710'))).toEqual({
      range: '7d',
      categoryId: 'food',
      walletId: 'w1',
      view: 'heat',
      layer: 'satellite',
      sort: 'visits',
      placeId: '3.1300,101.6710',
    });
    expect(readPlacesQuery(new URLSearchParams('range=year')).range).toBe('30d');
  });
});

describe('the places list', () => {
  it('sorts by spent as given, or by visits then spent', () => {
    expect(sortPlaces([bangsar, midValley, klcc], 'spent').map((p) => p.name)).toEqual(['Bangsar', 'Mid Valley', 'KLCC']);
    expect(sortPlaces([bangsar, midValley, klcc], 'visits').map((p) => p.name)).toEqual(['KLCC', 'Bangsar', 'Mid Valley']);
  });

  it('names two categories, how many more, and the visits', () => {
    const name = (id: string | null) => (id ? names[id]! : 'Other');
    expect(placeMeta(bangsar, name)).toBe('6 visits for Groceries, Food & Dining');
    expect(placeMeta(midValley, name)).toBe('4 visits for Shopping, Food & Dining +2');
    expect(placeMeta(place('t', 'TTDI', 6000, 1, ['transport']), () => 'Transport')).toBe('1 visit for Transport');
  });

  it('says where a place is and how often', () => {
    expect(placeSub(bangsar)).toBe('Kuala Lumpur, 6 payments on 6 days');
    expect(placeSub(place('h', 'Home', 100, 1, ['food'], null))).toBe('1 payment on 1 day');
  });

  it('names the hot spot and its share', () => {
    expect(hotSpot([bangsar, midValley, klcc])).toBe('Bangsar is your hot spot, 51% of it.');
    expect(hotSpot([klcc])).toBe('All of it was at KLCC.');
    expect(hotSpot([])).toBe('');
  });
});

describe('the map view', () => {
  it('leaves fitted points where they are at Fit', () => {
    expect(toView({ x: 120, y: 80 }, FIT, box)).toEqual({ x: 120, y: 80 });
  });

  it('zooms about the centre, keeping it still', () => {
    const view = zoomView(FIT, 2, { x: 400, y: 300 }, box);
    expect(view).toEqual({ zoom: 2, x: 0, y: 0 });
    expect(toView({ x: 500, y: 300 }, view, box)).toEqual({ x: 600, y: 300 });
  });

  it('zooms about a pin, keeping that pin still', () => {
    const view = zoomView(FIT, 2, { x: 500, y: 400 }, box);
    expect(view).toEqual({ zoom: 2, x: -100, y: -100 });
    expect(toView({ x: 500, y: 400 }, view, box)).toEqual({ x: 500, y: 400 });
  });

  it('pans at Fit too, as far as keeping the middle over the places', () => {
    expect(panView(FIT, { x: 50, y: -30 }, box)).toEqual({ zoom: 1, x: 50, y: -30 });
    expect(panView(FIT, { x: 900, y: -900 }, box)).toEqual({ zoom: 1, x: 400, y: -300 });
    expect(panView({ zoom: 2, x: 0, y: 0 }, { x: 900, y: -20 }, box)).toEqual({ zoom: 2, x: 800, y: -20 });
  });

  it('zooms out past Fit and in to the street, within the limits the ground can follow', () => {
    expect(zoomView(FIT, 0.5, { x: 400, y: 300 }, box)).toEqual({ zoom: 0.5, x: 0, y: 0 });
    expect(zoomView({ zoom: 3, x: 0, y: 0 }, 2, { x: 400, y: 300 }, box, { min: 1, max: 4 }).zoom).toBe(4);
    expect(zoomView(FIT, 0.01, { x: 400, y: 300 }, box, { min: 0.25, max: 4 }).zoom).toBe(0.25);
    expect(zoomLimits(12)).toEqual({ min: 2 ** -7, max: 2 ** 8 });
    expect(zoomLimits(21)).toEqual({ min: 2 ** -16, max: 1 });
  });

  it('pinches about where the fingers started and follows their middle', () => {
    const view = pinchView(FIT, [{ x: 300, y: 300 }, { x: 500, y: 300 }], [{ x: 250, y: 320 }, { x: 650, y: 320 }], box);
    expect(view.zoom).toBe(2);
    expect(toView({ x: 400, y: 300 }, view, box)).toEqual({ x: 450, y: 320 });
  });

  it('zooms half a level a mouse notch, never more than a level an event, and gently on a trackpad', () => {
    expect(wheelFactor(100, 0, false)).toBeCloseTo(2 ** -0.5);
    expect(wheelFactor(-100, 0, false)).toBeCloseTo(2 ** 0.5);
    expect(wheelFactor(3, 1, false)).toBeCloseTo(2 ** -0.6);
    expect(wheelFactor(-10, 0, true)).toBeCloseTo(2 ** 0.1);
    expect(wheelFactor(-9, 0, false)).toBeCloseTo(2 ** (9 / 450));
    expect(wheelFactor(5000, 0, false)).toBe(0.5);
    expect(wheelFactor(-5000, 0, true)).toBe(2);
    expect(wheelGlides(100, 0)).toBe(true);
    expect(wheelGlides(4, 0)).toBe(false);
    expect(wheelGlides(1, 1)).toBe(true);
  });

  it('never hands the map a camera that is not a number when a glide frame lands before its start', () => {
    const view = { zoom: 2, x: 10, y: -10 };
    expect(Object.values(zoomView(view, wheelFactor(100, 0, false), { x: 100, y: 100 }, box)).every(Number.isFinite)).toBe(true);
  });

  it('centres a point at a zoom', () => {
    const view = centreOn({ x: 500, y: 400 }, 2, box);
    expect(toView({ x: 500, y: 400 }, view, box)).toEqual({ x: 400, y: 300 });
  });

  it('leaves the map alone for a picked pin already well inside it', () => {
    const view = { zoom: 2, x: -100, y: 0 };
    expect(viewForPick(view, { x: 450, y: 300 }, box, () => true)).toBe(view);
  });

  it('centres a picked place near the edge, and zooms in until its pin stands alone', () => {
    const edge = viewForPick(FIT, { x: 780, y: 300 }, box, () => true);
    expect(edge.zoom).toBe(1);
    expect(toView({ x: 780, y: 300 }, edge, box)).toEqual({ x: 400, y: 300 });
    const merged = viewForPick(FIT, { x: 400, y: 300 }, box, (zoom) => zoom >= 2);
    expect(merged.zoom).toBe(2.25);
    expect(toView({ x: 400, y: 300 }, merged, box)).toEqual({ x: 400, y: 300 });
  });

  it('slows a fling down', () => {
    const later = flingSpeed({ x: 1, y: -2 }, 100);
    expect(later.x).toBeCloseTo(0.548, 3);
    expect(later.y).toBeCloseTo(-1.096, 3);
  });
});

describe('pins and heat', () => {
  it('sizes a capsule by its label, its stacked bubbles and a cluster badge', () => {
    expect(pinWidth('RM294', 1)).toBe(97);
    expect(pinWidth('RM100', 2)).toBe(127);
    expect(pinWidth('RM100', 3, 3)).toBe(163);
  });

  it('sizes a blob by the square root of its share', () => {
    expect(heatSize(100, 100)).toBe(206);
    expect(heatSize(25, 100)).toBe(131);
    expect(heatSize(0, 0)).toBe(56);
  });
});

describe('visitColumns', () => {
  const byDay = {
    '2026-07-22': { totalMinor: 14050 as MinorAmount, categoryId: null },
    '2026-07-23': { totalMinor: 900 as MinorAmount, categoryId: 'food' },
  };
  const allTime = placeDays({ from: '2026-07-22', to: '2026-11-28' });

  it("groups a long range into weeks ending today, each with its biggest day's category, so no bar is too thin to see", () => {
    const columns = visitColumns(allTime, byDay);
    expect(columns).toHaveLength(19);
    expect(columns.at(-1)?.key).toBe('2026-11-22');
    expect(columns[0]).toMatchObject({ key: '2026-07-22', name: 'Week of 22 Jul', totalMinor: 14950, categoryId: null });
  });

  it('drops a label that would crowd the one before it, and keeps Today', () => {
    expect(visitColumns(allTime, byDay).map((column) => column.tick).filter(Boolean)).toEqual(['22 Jul', 'Sep', 'Oct', 'Today']);
  });

  it('keeps a column a day up to 45 days, labelling the first, each 1st and Today', () => {
    const columns = visitColumns(placeDays({ from: '2026-09-15', to: '2026-10-14' }), {});
    expect(columns).toHaveLength(30);
    expect(columns.map((column) => column.tick).filter(Boolean)).toEqual(['15 Sep', '1 Oct', 'Today']);
  });

  it('labels every other day over a week', () => {
    expect(visitColumns(placeDays({ from: '2026-10-08', to: '2026-10-14' }), {}).map((column) => column.tick)).toEqual(['8 Oct', null, '10', null, '12', null, 'Today']);
  });
});

describe('clearOfFloats', () => {
  const base = { top: 36, right: 64, bottom: 64, left: 64 };
  const pin = { width: 100, height: 44 };

  it("lifts the fit above the phone's row of zoom controls along the foot", () => {
    const row = { left: 214, top: 240, right: 374, bottom: 284 };
    expect(clearOfFloats(base, { width: 390, height: 300 }, [row], pin)).toEqual({ ...base, bottom: 82 });
  });

  it('pushes the fit in from a tall column of controls at the right edge', () => {
    const column = { left: 1000, top: 400, right: 1084, bottom: 584 };
    expect(clearOfFloats(base, { width: 1100, height: 600 }, [column], pin)).toEqual({ ...base, right: 150 });
  });

  it('clears a button in the top corner from the top and leaves a hidden control out', () => {
    const layer = { left: 330, top: 16, right: 374, bottom: 60 };
    const hidden = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(clearOfFloats(base, { width: 390, height: 300 }, [layer, hidden], pin)).toEqual({ ...base, top: 82 });
  });
});

describe('pinClear', () => {
  const box = { width: 390, height: 300 };
  const row = { left: 214, top: 240, right: 374, bottom: 284 };
  const pin = { width: 140, height: 44 };

  it('hides a capsule whose edge reaches under a control', () => {
    expect(pinClear({ x: 250, y: 222 }, pin, box, [row])).toBe(false);
  });

  it("hides a capsule the map's edge cuts", () => {
    expect(pinClear({ x: 250, y: 7 }, pin, box, [])).toBe(false);
    expect(pinClear({ x: 380, y: 150 }, pin, box, [])).toBe(false);
  });

  it('shows a capsule clear of every edge and control, a hidden control left out', () => {
    expect(pinClear({ x: 250, y: 210 }, pin, box, [row])).toBe(true);
    expect(pinClear({ x: 150, y: 150 }, pin, box, [{ left: 0, top: 0, right: 0, bottom: 0 }])).toBe(true);
  });
});
