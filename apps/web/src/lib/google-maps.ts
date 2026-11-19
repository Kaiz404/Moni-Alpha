import type { MapStyleRule } from '@repo/design';

/**
 * The browser key for the Maps JavaScript API and the Maps Static API, restricted by HTTP referrer to the
 * web app's origins. Unset, every map reads Map unavailable.
 */
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null;

export type LatLngLiteral = { lat: number; lng: number };

/** The few calls Moni makes on a `google.maps.Map`. */
export type GoogleMap = {
  moveCamera(camera: { center: LatLngLiteral; zoom: number }): void;
  setOptions(options: { styles: readonly MapStyleRule[]; backgroundColor?: string }): void;
};

type MapsApi = { Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap };

type MapsWindow = Window & {
  google?: { maps?: MapsApi };
  __moniMapsReady?: () => void;
  gm_authFailure?: () => void;
};

let loading: Promise<MapsApi> | null = null;
let rejected = false;
const rejectedListeners = new Set<() => void>();

/** Loads the Maps JavaScript API once per tab. Each map made after it bills one Dynamic Maps load. */
export function loadMaps(key: string): Promise<MapsApi> {
  const win = window as MapsWindow;
  if (win.google?.maps?.Map) return Promise.resolve(win.google.maps);
  loading ??= new Promise<MapsApi>((resolve, reject) => {
    win.__moniMapsReady = () => (win.google?.maps ? resolve(win.google.maps) : reject(new Error('Maps did not load')));
    // Google calls this when the key is refused (wrong referrer, API not enabled, billing off).
    win.gm_authFailure = () => {
      rejected = true;
      rejectedListeners.forEach((listener) => listener());
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__moniMapsReady`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error('Maps did not load'));
    };
    document.head.append(script);
  });
  return loading;
}

/** Runs `listener` once Google refuses the key; true at once when it already has. */
export function onKeyRejected(listener: () => void): () => void {
  if (rejected) listener();
  rejectedListeners.add(listener);
  return () => rejectedListeners.delete(listener);
}

/** A style rule in the Static Maps `style` parameter's words: `feature:poi|element:geometry|color:0xF2ECE0`. */
export function staticStyle(rule: MapStyleRule): string {
  return [
    rule.featureType && `feature:${rule.featureType}`,
    rule.elementType && `element:${rule.elementType}`,
    ...rule.stylers.flatMap((styler) => Object.entries(styler).map(([name, value]) => `${name}:${value.startsWith('#') ? `0x${value.slice(1)}` : value}`)),
  ]
    .filter(Boolean)
    .join('|');
}

/**
 * A Maps Static API image of `center` at a whole `zoom`, `width` × `height` CSS px drawn at twice the
 * pixels. One request bills one Static Maps load; the same URL again comes from the browser's cache.
 */
export function staticMapUrl({
  key,
  center,
  zoom,
  width,
  height,
  styles,
}: {
  key: string;
  center: LatLngLiteral;
  zoom: number;
  width: number;
  height: number;
  styles: readonly MapStyleRule[];
}): string {
  const params = new URLSearchParams({
    center: `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`,
    zoom: String(zoom),
    size: `${Math.min(640, Math.round(width))}x${Math.min(640, Math.round(height))}`,
    scale: '2',
    key,
  });
  for (const rule of styles) params.append('style', staticStyle(rule));
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}

/** Web Mercator px at zoom 0 (one 256 px world). */
function worldPoint({ lat, lng }: LatLngLiteral): { x: number; y: number } {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: 256 * (0.5 + lng / 360), y: 256 * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) };
}

/**
 * Frames `points` on a static map of `width` × `height` with `pad` px kept clear at each edge: the
 * centre, the largest whole zoom that fits (at most `maxZoom`), and where each point lands in CSS px.
 */
export function staticFrame(points: readonly LatLngLiteral[], width: number, height: number, pad: number, maxZoom = 16) {
  const world = points.map(worldPoint);
  const xs = world.map((point) => point.x);
  const ys = world.map((point) => point.y);
  const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 1e-9);
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 1e-9);
  const fit = Math.floor(Math.log2(Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY)));
  const zoom = Math.max(0, Math.min(maxZoom, fit));
  const scale = 2 ** zoom;
  const lng = (mid.x / 256 - 0.5) * 360;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * mid.y) / 256))) * 180) / Math.PI;
  return {
    center: { lat, lng },
    zoom,
    at: (point: LatLngLiteral) => {
      const at = worldPoint(point);
      return { x: width / 2 + (at.x - mid.x) * scale, y: height / 2 + (at.y - mid.y) * scale };
    },
  };
}
