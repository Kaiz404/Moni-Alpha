import { addMinor, type MinorAmount } from '@repo/types';

import type { Point } from '../charts/month-charts';
import type { LatLng, Place } from './places';

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
};

const PIN_GAP = 4;
const PIN_ROW = 36;

/**
 * Merges pins whose capsules would overlap on screen, largest place first, as
 * `XM-Places` draws "RM328 2". `toScreen` maps a coordinate to view pixels;
 * `widthOf` estimates a capsule's width from its label and member count, and `row` is how far apart two
 * capsules' centres must sit up and down not to touch.
 */
export function clusterPins(
  places: readonly Place[],
  toScreen: (point: LatLng) => Point,
  widthOf: (totalMinor: MinorAmount, members: number) => number,
  row = PIN_ROW,
): PinCluster[] {
  const seeds: (PinCluster & Point & { width: number })[] = [];
  for (const place of [...places].sort((a, b) => b.totalMinor - a.totalMinor)) {
    const { x, y } = toScreen(place);
    const width = widthOf(place.totalMinor, 1);
    const hit = seeds.find(
      (seed) => Math.abs(seed.x - x) < (seed.width + width) / 2 + PIN_GAP && Math.abs(seed.y - y) < row,
    );
    if (hit) {
      hit.members.push(place);
      hit.totalMinor = addMinor(hit.totalMinor, place.totalMinor);
      hit.width = widthOf(hit.totalMinor, hit.members.length);
    } else {
      seeds.push({ lead: place, members: [place], totalMinor: place.totalMinor, x, y, width });
    }
  }
  return seeds.map(({ lead, members, totalMinor }) => ({ lead, members, totalMinor }));
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

/**
 * Places every point inside `box` less `insets`, north up, at one scale across and down (a degree of
 * longitude shrunk by the cosine of the latitude), centred. A spread under `minSpan` degrees is drawn
 * as `minSpan`, so one place or a tight cluster sits in the middle instead of filling the box.
 */
export function fitProjector(points: readonly LatLng[], box: Box, insets: Insets, minSpan = 0.01) {
  const free = { width: box.width - insets.left - insets.right, height: box.height - insets.top - insets.bottom };
  const centre = { x: insets.left + free.width / 2, y: insets.top + free.height / 2 };
  if (!points.length) return (): Point => centre;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const across = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((Math.max(...lngs) - Math.min(...lngs)) * across, minSpan);
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), minSpan);
  const scale = Math.min(free.width / spanX, free.height / spanY);
  return (point: LatLng): Point => ({
    x: centre.x + (point.longitude - midLng) * across * scale,
    y: centre.y - (point.latitude - midLat) * scale,
  });
}
