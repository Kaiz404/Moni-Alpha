import type { Place } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
  FIT,
  heatSize,
  hotSpot,
  panView,
  pinWidth,
  placeMeta,
  placeSub,
  readPlacesQuery,
  sortPlaces,
  toView,
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
    expect(readPlacesQuery(new URLSearchParams(''))).toEqual({ range: '30d', categoryId: null, walletId: null, view: 'pins', sort: 'spent', placeId: null });
    expect(readPlacesQuery(new URLSearchParams('range=7d&category=food&wallet=w1&view=heat&sort=visits&place=3.1300,101.6710'))).toEqual({
      range: '7d',
      categoryId: 'food',
      walletId: 'w1',
      view: 'heat',
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
    expect(placeMeta(bangsar, name)).toBe('Groceries, Food & Dining with 6 visits');
    expect(placeMeta(midValley, name)).toBe('Shopping, Food & Dining +2 with 4 visits');
    expect(placeMeta(place('t', 'TTDI', 6000, 1, ['transport']), () => 'Transport')).toBe('Transport with 1 visit');
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

  it('stays between 1 and 4, and never pans past the art', () => {
    expect(zoomView(FIT, 0.5, { x: 0, y: 0 }, box)).toEqual(FIT);
    expect(zoomView({ zoom: 3, x: 0, y: 0 }, 2, { x: 400, y: 300 }, box).zoom).toBe(4);
    expect(panView(FIT, { x: 50, y: 50 }, box)).toEqual(FIT);
    expect(panView({ zoom: 2, x: 0, y: 0 }, { x: 900, y: -20 }, box)).toEqual({ zoom: 2, x: 400, y: -20 });
  });
});

describe('pins and heat', () => {
  it('sizes a capsule by its label and a cluster badge', () => {
    expect(pinWidth('RM294', 1)).toBe(97);
    expect(pinWidth('RM100', 2)).toBe(127);
  });

  it('sizes a blob by the square root of its share', () => {
    expect(heatSize(100, 100)).toBe(206);
    expect(heatSize(25, 100)).toBe(131);
    expect(heatSize(0, 0)).toBe(56);
  });
});
