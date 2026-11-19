'use client';

import { clusterPins, fitProjector, formatMoney, type Box, type Insets, type Place } from '@repo/core';
import type { CurrencyCode } from '@repo/types';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Bubble } from '@/components/ledger/glyph';
import type { LayoutKind } from '@/lib/layout';
import { FIT, heatSize, panView, pinWidth, toView, zoomView, type MapView } from '@/lib/places-view';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { MapArt } from './map-art';
import { Mdi } from './mdi';

/** W2-Places' 40-tall capsules with a little air: closer than this up and down, they merge. */
const PIN_ROW = 44;

/** Room for the controls floating on the map, so no pin sits under them. */
function insetsFor(layout: LayoutKind | null): Insets {
  return layout === 'phone' ? { top: 36, right: 64, bottom: 64, left: 64 } : { top: 96, right: 80, bottom: 96, left: 80 };
}

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setBox({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, box] as const;
}

export type MapProps = {
  ledger: Ledger;
  layout: LayoutKind | null;
  everywhere: Place[];
  places: Place[];
  selectedId: string | null;
  hoverId: string | null;
  heat: boolean;
  view: MapView;
  onView: (view: MapView) => void;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
  onHeat: (heat: boolean) => void;
  emptyLine: string;
  locationOff: boolean;
};

/**
 * The drawn map with a pin per place by its coordinates. Zoom and Fit scale the art with a CSS transform
 * and move the pins with it; pins whose capsules touch at the current zoom merge into one with a count.
 */
export function PlaceMap({ ledger, layout, everywhere, places, selectedId, hoverId, heat, view, onView, onPick, onHover, onHeat, emptyLine, locationOff }: MapProps) {
  const [ref, box] = useBox();
  const currency = ledger.currency as CurrencyCode;
  const fitted = useMemo(() => (box ? fitProjector(everywhere, box, insetsFor(layout)) : null), [box, everywhere, layout]);
  const at = (place: Place) => (fitted && box ? toView(fitted(place), view, box) : { x: 0, y: 0 });
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  const clusters = fitted && box ? clusterPins(places, (point) => toView(fitted(point), view, box), (total, members) => pinWidth(whole(total), members), PIN_ROW) : [];
  const leadOf = new Map(clusters.flatMap((cluster) => cluster.members.map((member) => [member.id, cluster] as const)));
  const max = places.reduce((top, place) => Math.max(top, place.totalMinor), 0);
  const drag = useRef<{ x: number; y: number; view: MapView } | null>(null);
  const [dragging, setDragging] = useState(false);
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const zoom = (factor: number) => {
    if (!box) return;
    const selected = places.find((place) => place.id === selectedId);
    onView(zoomView(view, factor, selected ? at(selected) : { x: box.width / 2, y: box.height / 2 }, box));
  };
  const pick = (id: string) => {
    const cluster = leadOf.get(id);
    if (cluster && cluster.members.length > 1 && box) onView(zoomView(view, 2, at(cluster.lead), box));
    onPick(cluster?.lead.id ?? id);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (view.zoom === 1 || (event.target as HTMLElement).closest('button')) return;
    drag.current = { x: event.clientX, y: event.clientY, view };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !box) return;
    onView(panView(drag.current.view, { x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }, box));
  };

  return (
    <div
      ref={ref}
      className="places-map"
      data-heat={heat || undefined}
      data-zoomed={view.zoom > 1 || undefined}
      data-faded={locationOff || undefined}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="map-art-pan" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <MapArt />
      </div>
      {box &&
        places.map((place) => {
          const { x, y } = at(place);
          const size = heatSize(place.totalMinor, max);
          return (
            <button
              key={`heat-${place.id}`}
              type="button"
              tabIndex={heat ? 0 : -1}
              className="heat-blob"
              data-on={heat || undefined}
              aria-hidden={!heat}
              aria-label={`${place.name}, ${formatMoney(place.totalMinor, currency)}`}
              style={{ left: x - size / 2, top: y - size / 2, width: size, height: size, ['--core' as string]: (0.35 + (0.55 * place.totalMinor) / (max || 1)).toFixed(2) }}
              onClick={() => onPick(place.id)}
              onMouseEnter={() => onHover(place.id)}
              onMouseLeave={() => onHover(null)}
            >
              <span />
              <span />
              <span />
            </button>
          );
        })}
      {box &&
        places.map((place) => {
          const cluster = leadOf.get(place.id);
          const lead = cluster?.lead.id === place.id;
          const members = cluster?.members ?? [place];
          const on = members.some((member) => member.id === selectedId);
          const hot = members.some((member) => member.id === hoverId);
          const shown = lead && (!heat || on || hot);
          const category = projectionCategory(ledger, (cluster?.lead ?? place).categories[0]?.categoryId ?? null);
          const { x, y } = at(lead ? place : (cluster?.lead ?? place));
          const names = members.map((member) => member.name).join(' and ');
          return (
            <button
              key={place.id}
              type="button"
              className="map-pin-big"
              data-place={place.id}
              data-shown={shown || undefined}
              data-on={(shown && on) || undefined}
              data-hot={(shown && hot && !on) || undefined}
              data-dim={(shown && selectedId !== null && !on && !hot) || undefined}
              aria-hidden={!shown}
              tabIndex={shown ? 0 : -1}
              aria-label={`${names}, ${formatMoney(cluster?.totalMinor ?? place.totalMinor, currency)}`}
              style={{ left: x, top: y }}
              onClick={() => pick(place.id)}
              onMouseEnter={() => onHover(place.id)}
              onMouseLeave={() => onHover(null)}
            >
              <span className="pin-body">
                <Bubble icon={category?.icon} color={category?.color ?? null} size={28} glyph={16} />
                <span className="num pin-amount">{whole(cluster?.totalMinor ?? place.totalMinor)}</span>
                {members.length > 1 && <span className="num pin-count">{members.length}</span>}
              </span>
            </button>
          );
        })}
      {everywhere.length === 0 ? (
        <div className="map-note map-empty-card motion-rise">
          <span className="map-empty-icon">
            <Mdi name="map-marker-outline" size={20} />
          </span>
          <strong>No places yet</strong>
          <span>Pay somewhere with location on and it lands here. Bills and online buys stay off the map.</span>
        </div>
      ) : (
        places.length === 0 && (
          <div className="map-note map-float-line motion-rise" role="status">
            <Mdi name="map-marker-off-outline" size={20} />
            {emptyLine}
          </div>
        )
      )}
      {locationOff && everywhere.length > 0 && (
        <div className="map-banner">
          <span className="map-banner-icon">
            <Mdi name="map-marker-off-outline" size={20} />
          </span>
          <span className="map-banner-text">
            <strong>Location is off for new payments</strong>
            <span>Your places so far stay. New payments land here once Location from notifications is back on.</span>
          </span>
          <Link href="/settings" className="btn btn-sand press">
            Turn location back on
          </Link>
        </div>
      )}
      <div className="map-float map-views" data-only="sidebar rail rail-one-column">
        <span className="pseg" role="radiogroup" aria-label="Map view">
          <span className="pseg-pill" aria-hidden="true" style={{ transform: `translateX(${heat ? 100 : 0}%)` }} />
          <button type="button" role="radio" aria-checked={!heat} onClick={() => onHeat(false)}>
            Pins
          </button>
          <button type="button" role="radio" aria-checked={heat} onClick={() => onHeat(true)}>
            Heat
          </button>
        </span>
        <span className="kbd">H</span>
      </div>
      <div className="map-zoom">
        <button type="button" className="map-float map-btn map-fit press" title="Fit every place" onClick={() => onView(FIT)}>
          <Mdi name="fit-to-screen-outline" size={20} />
          <span>Fit</span>
          <span className="kbd" data-only="sidebar rail rail-one-column">
            F
          </span>
        </button>
        <span className="map-float map-zoom-pair">
          <button type="button" className="map-btn" aria-label="Zoom in" disabled={view.zoom >= 4} onClick={() => zoom(1.5)}>
            <Mdi name="plus" size={22} />
          </button>
          <span className="map-zoom-rule" aria-hidden="true" />
          <button type="button" className="map-btn" aria-label="Zoom out" disabled={view.zoom <= 1} onClick={() => zoom(1 / 1.5)}>
            <Mdi name="minus" size={22} />
          </button>
        </span>
      </div>
    </div>
  );
}

export function projectionCategory(ledger: Ledger, id: string | null) {
  return id ? ledger.projection.categoriesById[id] : undefined;
}
