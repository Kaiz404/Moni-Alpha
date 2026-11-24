'use client';

import { googleZoom, type Box, type FitFrame } from '@repo/core';
import { mapStyles, type MapStyleRule } from '@repo/design';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/use-theme';
import { loadMaps, MAPS_KEY, onKeyRejected, type GoogleMap } from '@/lib/google-maps';
import type { MapView } from '@/lib/places-view';

/** Over the satellite photos only place and area names show: no road lines, road names, shops or transit. */
const SATELLITE_LABELS: readonly MapStyleRule[] = [
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/** True while the Maps key is set and Google has not refused it. */
export function useMapsUsable(): boolean {
  const [refused, setRefused] = useState(false);
  useEffect(() => (MAPS_KEY ? onKeyRejected(() => setRefused(true)) : undefined), []);
  return Boolean(MAPS_KEY) && !refused;
}

/**
 * The Google map under Where you spend's pins, styled like the phone's. It takes no gestures (the layer over it does): its camera
 * follows the pins' own frame and the page's zoom and pan, so a pin sits on its real street. Without a
 * usable key the ground is plain, with Map unavailable, as on the phone.
 */
export function MapGround({ frame, view, box, satellite = false }: { frame: FitFrame | null; view: MapView; box: Box | null; satellite?: boolean }) {
  const usable = useMapsUsable();
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<GoogleMap | null>(null);
  const [failed, setFailed] = useState(false);
  const dark = useTheme().resolved === 'dark';

  useEffect(() => {
    if (!usable || !MAPS_KEY || !host.current) return;
    let live = true;
    loadMaps(MAPS_KEY)
      .then((api) => {
        if (!live || !host.current) return;
        setMap(
          new api.Map(host.current, {
            center: { lat: 3.139, lng: 101.6869 },
            zoom: 12,
            disableDefaultUI: true,
            gestureHandling: 'none',
            keyboardShortcuts: false,
            clickableIcons: false,
            isFractionalZoomEnabled: true,
          }),
        );
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [usable]);

  useEffect(() => {
    // Satellite photos take no styles; "hybrid" keeps Google's street and place names over them.
    map?.setOptions({ styles: satellite ? SATELLITE_LABELS : dark ? mapStyles.dark : mapStyles.light, mapTypeId: satellite ? 'hybrid' : 'roadmap' });
  }, [map, dark, satellite]);

  useEffect(() => {
    if (!map || !frame || !box) return;
    const middle = { x: box.width / 2, y: box.height / 2 };
    const centre = frame.unproject({ x: middle.x - view.x / view.zoom, y: middle.y - view.y / view.zoom });
    const zoom = googleZoom(frame.pxPerLngDegree * view.zoom);
    // Google throws on a camera that isn't finite, and the map would stop moving; skip such a frame.
    if (![centre.latitude, centre.longitude, zoom].every(Number.isFinite)) return;
    map.moveCamera({ center: { lat: Math.max(-85, Math.min(85, centre.latitude)), lng: centre.longitude }, zoom });
  }, [map, frame, box, view]);

  if (!usable || failed) {
    return (
      <div className="map-ground" data-unavailable="true">
        <span className="map-unavailable">Map unavailable</span>
      </div>
    );
  }
  return <div ref={host} className="map-ground" data-google="true" aria-label="Google map" role="img" />;
}
