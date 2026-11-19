import { placesTotal, sharePercent, type Box, type Place, type PlaceRangeKey, type Point } from '@repo/core';

/** Where you spend's state in the URL, so a reload or the 700 crossing keeps it. */
export type PlacesQuery = {
  range: PlaceRangeKey;
  categoryId: string | null;
  walletId: string | null;
  view: 'pins' | 'heat';
  sort: 'spent' | 'visits';
  placeId: string | null;
};

const RANGES: readonly PlaceRangeKey[] = ['7d', '30d', 'all'];

export function readPlacesQuery(params: URLSearchParams): PlacesQuery {
  const range = params.get('range');
  return {
    range: RANGES.includes(range as PlaceRangeKey) ? (range as PlaceRangeKey) : '30d',
    categoryId: params.get('category'),
    walletId: params.get('wallet'),
    view: params.get('view') === 'heat' ? 'heat' : 'pins',
    sort: params.get('sort') === 'visits' ? 'visits' : 'spent',
    placeId: params.get('place'),
  };
}

/** Spent is largest first (as `groupPlaces` returns them); Visits is most payments first, then spent. */
export function sortPlaces(places: readonly Place[], sort: PlacesQuery['sort']): Place[] {
  if (sort === 'spent') return [...places];
  return [...places].sort((a, b) => b.count - a.count || b.totalMinor - a.totalMinor);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "6 visits for Groceries, Food +2": how many payments, then the two biggest categories. */
export function placeMeta(place: Place, categoryName: (id: string | null) => string): string {
  const names = place.categories.map((category) => categoryName(category.categoryId));
  const more = names.length > 2 ? ` +${names.length - 2}` : '';
  return `${plural(place.count, 'visit')} for ${names.slice(0, 2).join(', ')}${more}`;
}

/** "Kuala Lumpur, 6 payments on 4 days". */
export function placeSub(place: Place): string {
  return `${place.area ? `${place.area}, ` : ''}${plural(place.count, 'payment')} on ${plural(place.days, 'day')}`;
}

/** The summary's sentence: the hot spot and its share, or where all of it went. */
export function hotSpot(places: readonly Place[]): string {
  if (!places.length) return '';
  const top = places.reduce((best, place) => (place.totalMinor > best.totalMinor ? place : best));
  if (places.length === 1) return `All of it was at ${top.name}.`;
  return `${top.name} is your hot spot, ${sharePercent(top.totalMinor, placesTotal(places))}% of it.`;
}

/** The map's zoom and pan over its fitted art: 1 and no pan is Fit. */
export type MapView = { zoom: number; x: number; y: number };

export const FIT: MapView = { zoom: 1, x: 0, y: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Where a fitted point lands on screen under a view: scaled about the box's centre, then panned. */
export function toView(point: Point, view: MapView, box: Box): Point {
  return {
    x: box.width / 2 + (point.x - box.width / 2) * view.zoom + view.x,
    y: box.height / 2 + (point.y - box.height / 2) * view.zoom + view.y,
  };
}

/** Keeps the art over the whole box: the pan never shows past its edge. */
function clampPan(view: MapView, box: Box): MapView {
  const room = (size: number) => ((view.zoom - 1) * size) / 2;
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value)) || 0;
  return { zoom: view.zoom, x: clamp(view.x, room(box.width)), y: clamp(view.y, room(box.height)) };
}

/** Zooms by `factor` and keeps `focus` (a screen point) where it is, as a map does under its controls. */
export function zoomView(view: MapView, factor: number, focus: Point, box: Box): MapView {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
  const centre = { x: box.width / 2, y: box.height / 2 };
  const ratio = zoom / view.zoom;
  return clampPan(
    {
      zoom,
      x: focus.x - centre.x - (focus.x - centre.x - view.x) * ratio,
      y: focus.y - centre.y - (focus.y - centre.y - view.y) * ratio,
    },
    box,
  );
}

export function panView(view: MapView, by: Point, box: Box): MapView {
  return clampPan({ zoom: view.zoom, x: view.x + by.x, y: view.y + by.y }, box);
}

/** W2-Places' capsule: the bubble and padding, about 9 a glyph, and the count badge. */
export function pinWidth(label: string, members: number): number {
  return 52 + label.length * 9 + (members > 1 ? 30 : 0);
}

/** A heat blob's width: 56 at nothing, 206 for the biggest place, by the square root of its share. */
export function heatSize(totalMinor: number, maxMinor: number): number {
  return Math.round(56 + 150 * Math.sqrt(maxMinor > 0 ? totalMinor / maxMinor : 0));
}
