import { addMinor, type MinorAmount } from '@repo/types';
import type { LatLng, Place } from '@repo/core';

export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

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
 * `widthOf` estimates a capsule's width from its label and member count.
 */
export function clusterPins(
  places: readonly Place[],
  toScreen: (point: LatLng) => { x: number; y: number },
  widthOf: (totalMinor: MinorAmount, members: number) => number,
): PinCluster[] {
  const seeds: (PinCluster & { x: number; y: number; width: number })[] = [];
  for (const place of places) {
    const { x, y } = toScreen(place);
    const width = widthOf(place.totalMinor, 1);
    const hit = seeds.find(
      (seed) => Math.abs(seed.x - x) < (seed.width + width) / 2 + PIN_GAP && Math.abs(seed.y - y) < PIN_ROW,
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

/** Linear screen projection of a map region; close enough at city zoom. */
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

export function projector(region: Region, size: { width: number; height: number }) {
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  return (point: LatLng) => ({
    x: ((point.longitude - west) / region.longitudeDelta) * size.width,
    y: ((north - point.latitude) / region.latitudeDelta) * size.height,
  });
}
