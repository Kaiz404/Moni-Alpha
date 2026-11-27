import { addMinor, type MinorAmount } from '@repo/types';

import type { Point } from '../charts/month-charts';
import type { LatLng, Place, PlaceCategory } from './places';

export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

export type Box = { width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

/** A region that frames every point with some margin, or null with none. */
export function regionFor(points: readonly LatLng[], minDelta = 0.02): Region | null {
  if (!points.length) return null;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, minDelta),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, minDelta),
  };
}

export type PinCluster = {
  /** The largest member, whose spot the pin sits on. */
  lead: Place;
  members: Place[];
  totalMinor: MinorAmount;
  /** Every member's spending by category, largest first. */
  categories: PlaceCategory[];
};

const PIN_GAP = 4;
const PIN_ROW = 36;

/** The most category bubbles a pin stacks; past it the last slot reads "+N". */
export const PIN_DISCS = 3;

/**
 * The bubbles a pin draws for its categories, largest first: all of them up to `PIN_DISCS`, or one
 * fewer and a "+N" disc for the rest.
 */
export function pinMix(categories: readonly PlaceCategory[]): { shown: PlaceCategory[]; more: number } {
  if (categories.length <= PIN_DISCS) return { shown: [...categories], more: 0 };
  return { shown: categories.slice(0, PIN_DISCS - 1), more: categories.length - (PIN_DISCS - 1) };
}

function mergeCategories(a: readonly PlaceCategory[], b: readonly PlaceCategory[]): PlaceCategory[] {
  const totals = new Map<string | null, MinorAmount>();
  for (const { categoryId, totalMinor } of [...a, ...b])
    totals.set(categoryId, addMinor(totals.get(categoryId) ?? 0, totalMinor));
  return [...totals.entries()]
    .map(([categoryId, totalMinor]) => ({ categoryId, totalMinor }))
    .sort((x, y) => y.totalMinor - x.totalMinor);
}

/** A pin with one member, as `clusterPins` returns it when nothing merges. */
export function singlePin(place: Place): PinCluster {
  return { lead: place, members: [place], totalMinor: place.totalMinor, categories: place.categories };
}

/**
 * Merges pins whose capsules would overlap on screen, largest place first, as
 * `XM-Places` draws "RM328 2". `toScreen` maps a coordinate to view pixels;
 * `widthOf` estimates a capsule's width from its label, member count and how many category discs
 * it stacks, and `row` is how far apart two capsules' centres must sit up and down not to touch.
 */
export function clusterPins(
  places: readonly Place[],
  toScreen: (point: LatLng) => Point,
  widthOf: (totalMinor: MinorAmount, members: number, discs: number) => number,
  row = PIN_ROW,
): PinCluster[] {
  const discs = (categories: readonly PlaceCategory[]) => Math.max(1, Math.min(categories.length, PIN_DISCS));
  const seeds: (PinCluster & Point & { width: number })[] = [];
  for (const place of [...places].sort((a, b) => b.totalMinor - a.totalMinor)) {
    const { x, y } = toScreen(place);
    const width = widthOf(place.totalMinor, 1, discs(place.categories));
    const hit = seeds.find(
      (seed) => Math.abs(seed.x - x) < (seed.width + width) / 2 + PIN_GAP && Math.abs(seed.y - y) < row,
    );
    if (hit) {
      hit.members.push(place);
      hit.totalMinor = addMinor(hit.totalMinor, place.totalMinor);
      hit.categories = mergeCategories(hit.categories, place.categories);
      hit.width = widthOf(hit.totalMinor, hit.members.length, discs(hit.categories));
    } else {
      seeds.push({ ...singlePin(place), members: [place], x, y, width });
    }
  }
  return seeds.map(({ lead, members, totalMinor, categories }) => ({ lead, members, totalMinor, categories }));
}

/** About a tenth of a zoom level's change in scale: pins can merge, and a pinch frame is cheap to skip. */
const ZOOM_STEP = 0.1;

/**
 * Whether a moving map has zoomed enough to cluster its pins again. Panning alone keeps the pins'
 * distances, so it never needs to.
 */
export function zoomMoved(previous: Region | null, next: Region): boolean {
  if (!previous) return true;
  return Math.abs(Math.log(next.latitudeDelta / previous.latitudeDelta)) > ZOOM_STEP;
}

/** Linear screen projection of a map region; close enough at city zoom. */
export function projector(region: Region, size: Box) {
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  return (point: LatLng): Point => ({
    x: ((point.longitude - west) / region.longitudeDelta) * size.width,
    y: ((north - point.latitude) / region.latitudeDelta) * size.height,
  });
}

/** Where the fitted points sit on screen and the way back, with the scale a Google map needs to match. */
export type FitFrame = {
  project: (point: LatLng) => Point;
  unproject: (point: Point) => LatLng;
  /** Screen px per degree of longitude, the unit Google's zoom is measured in. */
  pxPerLngDegree: number;
};

/**
 * Places every point inside `box` less `insets`, north up, at one scale across and down (a degree of
 * longitude shrunk by the cosine of the latitude), centred. A spread under `minSpan` degrees is drawn
 * as `minSpan`, so one place or a tight cluster sits in the middle instead of filling the box. Across a
 * city this is Web Mercator to well under a pixel, so a Google map under the pins lines up.
 */
export function fitFrame(points: readonly LatLng[], box: Box, insets: Insets, minSpan = 0.01): FitFrame {
  const free = { width: box.width - insets.left - insets.right, height: box.height - insets.top - insets.bottom };
  const centre = { x: insets.left + free.width / 2, y: insets.top + free.height / 2 };
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const midLat = points.length ? (Math.min(...lats) + Math.max(...lats)) / 2 : 3.139;
  const midLng = points.length ? (Math.min(...lngs) + Math.max(...lngs)) / 2 : 101.6869;
  const across = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max(points.length ? (Math.max(...lngs) - Math.min(...lngs)) * across : 0, minSpan);
  const spanY = Math.max(points.length ? Math.max(...lats) - Math.min(...lats) : 0, minSpan);
  const scale = Math.min(free.width / spanX, free.height / spanY);
  return {
    project: (point) => ({
      x: centre.x + (point.longitude - midLng) * across * scale,
      y: centre.y - (point.latitude - midLat) * scale,
    }),
    unproject: (point) => ({
      latitude: midLat - (point.y - centre.y) / scale,
      longitude: midLng + (point.x - centre.x) / (across * scale),
    }),
    pxPerLngDegree: across * scale,
  };
}

/** The Google Maps zoom at which a degree of longitude is `pxPerLngDegree` screen px (256 px tiles). */
export function googleZoom(pxPerLngDegree: number): number {
  return Math.log2((pxPerLngDegree * 360) / 256);
}
