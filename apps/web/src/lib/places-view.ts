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

/** How far the view may zoom out and in from Fit. */
export type ZoomLimits = { min: number; max: number };

export const DEFAULT_LIMITS: ZoomLimits = { min: 1 / 16, max: 64 };

/**
 * The zooms the Google map under the pins can follow from a Fit at Google zoom `fitZoom`: out to a
 * country (Google 5) and in to the street (Google 20), so the ground never stops while the pins move.
 */
export function zoomLimits(fitZoom: number): ZoomLimits {
  return { min: Math.min(1, 2 ** (5 - fitZoom)), max: Math.max(1, 2 ** (20 - fitZoom)) };
}

/** Where a fitted point lands on screen under a view: scaled about the box's centre, then panned. */
export function toView(point: Point, view: MapView, box: Box): Point {
  return {
    x: box.width / 2 + (point.x - box.width / 2) * view.zoom + view.x,
    y: box.height / 2 + (point.y - box.height / 2) * view.zoom + view.y,
  };
}

/** Keeps the box's centre over the fitted art, so a pan can never lose every place. */
function clampPan(view: MapView, box: Box): MapView {
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value)) || 0;
  return { zoom: view.zoom, x: clamp(view.x, (view.zoom * box.width) / 2), y: clamp(view.y, (view.zoom * box.height) / 2) };
}

/** Zooms by `factor` and keeps `focus` (a screen point) where it is, as a map does under a wheel or a pinch. */
export function zoomView(view: MapView, factor: number, focus: Point, box: Box, limits: ZoomLimits = DEFAULT_LIMITS): MapView {
  const zoom = Math.max(limits.min, Math.min(limits.max, view.zoom * factor));
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

/**
 * Two fingers moving from `from` to `to`: the map zooms by how far apart they went about where they
 * started, then follows their middle, so the ground stays under both fingers.
 */
export function pinchView(start: MapView, from: readonly [Point, Point], to: readonly [Point, Point], box: Box, limits: ZoomLimits = DEFAULT_LIMITS): MapView {
  const apart = (pair: readonly [Point, Point]) => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) || 1;
  const middle = (pair: readonly [Point, Point]) => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
  const [a, b] = [middle(from), middle(to)];
  return panView(zoomView(start, apart(to) / apart(from), a, box, limits), { x: b.x - a.x, y: b.y - a.y }, box);
}

/**
 * How much one wheel event zooms, as Google's map does with every gesture on it: a mouse notch (100 px)
 * is one zoom level, a trackpad's scroll the same per pixel, and a trackpad pinch (which the browser
 * sends as a wheel with Ctrl held) twice as quick, since its deltas are small.
 */
export function wheelFactor(deltaY: number, deltaMode: number, pinch: boolean): number {
  const px = deltaMode === 1 ? deltaY * 40 : deltaMode === 2 ? deltaY * 800 : deltaY;
  const capped = Math.max(-200, Math.min(200, px));
  return 2 ** ((-capped * (pinch ? 2 : 1)) / 100);
}

/** A mouse notch glides to its zoom; a trackpad's stream of small deltas is already smooth. */
export function wheelGlides(deltaY: number, deltaMode: number): boolean {
  return deltaMode !== 0 || Math.abs(deltaY) >= 50;
}

/** The view at `zoom` with a fitted point in the middle of the box. */
export function centreOn(point: Point, zoom: number, box: Box): MapView {
  return clampPan({ zoom, x: -(point.x - box.width / 2) * zoom, y: -(point.y - box.height / 2) * zoom }, box);
}

/** Whether a screen point sits inside the box less `inset` on every side, where a picked pin can stay put. */
export function inView(point: Point, box: Box, inset: number): boolean {
  return point.x >= inset && point.x <= box.width - inset && point.y >= inset && point.y <= box.height - inset;
}

/**
 * The view for a place just picked: where it already sits well inside the map on a pin of its own, the
 * map stays put; otherwise it zooms in by halves until its pin stands alone (`alone`), and centres it.
 */
export function viewForPick(view: MapView, point: Point, box: Box, alone: (zoom: number) => boolean, limits: ZoomLimits = DEFAULT_LIMITS): MapView {
  const shown = toView(point, view, box);
  if (alone(view.zoom) && inView(shown, box, Math.min(box.width, box.height) * 0.15)) return view;
  let zoom = Math.max(view.zoom, Math.min(1, limits.max));
  for (let step = 0; step < 8 && !alone(zoom) && zoom * 1.5 <= limits.max; step += 1) zoom *= 1.5;
  return centreOn(point, zoom, box);
}

/** A released drag keeps sliding: its speed (px a ms) after `ms` more, losing 0.6% of it a ms. */
export function flingSpeed(speed: Point, ms: number): Point {
  const keep = 0.994 ** ms;
  return { x: speed.x * keep, y: speed.y * keep };
}

/** W2-Places' capsule: the bubble and padding, about 9 a glyph, and the count badge. */
export function pinWidth(label: string, members: number): number {
  return 52 + label.length * 9 + (members > 1 ? 30 : 0);
}

/** A heat blob's width: 56 at nothing, 206 for the biggest place, by the square root of its share. */
export function heatSize(totalMinor: number, maxMinor: number): number {
  return Math.round(56 + 150 * Math.sqrt(maxMinor > 0 ? totalMinor / maxMinor : 0));
}
