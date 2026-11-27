'use client';

import { clusterPins, fitFrame, formatMoney, googleZoom, pinMix, type Box, type Insets, type Place, type PlaceCategory, type Point } from '@repo/core';
import type { CurrencyCode } from '@repo/types';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Bubble } from '@/components/ledger/glyph';
import type { LayoutKind } from '@/lib/layout';
import {
  clearOfFloats,
  DEFAULT_LIMITS,
  FIT,
  flingSpeed,
  heatSize,
  panView,
  pinchView,
  pinWidth,
  pinClear,
  toView,
  viewForPick,
  wheelFactor,
  wheelGlides,
  zoomLimits,
  zoomView,
  type Float,
  type MapView,
  type ZoomLimits,
} from '@/lib/places-view';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { MapGround, useMapsUsable } from './map-ground';
import { Mdi } from './mdi';

/** W2-Places' 40-tall capsules with a little air: closer than this up and down, they merge. */
const PIN_ROW = 44;

/** A press that moves less than this is a click, not a drag. */
const DRAG_SLOP = 4;

/** The fit's margin; `clearOfFloats` adds room for the controls floating on the map. */
function insetsFor(layout: LayoutKind | null): Insets {
  return layout === 'phone' ? { top: 36, right: 64, bottom: 64, left: 64 } : { top: 96, right: 80, bottom: 88, left: 80 };
}

/** The glide's time constant: about two thirds of the way in this many ms, settled in about four times it. */
const GLIDE_MS = 70;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where the map is going, and whether it glides there (a button, a pick) or is already under a finger (a drag, a pinch, a trackpad). */
export type MapMove = { view: MapView; glide: boolean };

/**
 * The view the map shows, easing to `target` with no overshoot, so the Google camera and the pins
 * move on one clock. A gesture or reduced motion jumps straight there.
 */
function useSlidingView(target: MapView, glide: boolean): MapView {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  const goal = useRef(target);
  const frame = useRef(0);
  goal.current = target;
  useEffect(() => {
    const from = current.current;
    if (!glide || reduced() || (from.zoom === target.zoom && from.x === target.x && from.y === target.y)) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      current.current = target;
      setShown(target);
      return;
    }
    // Already gliding: the running loop now chases the new goal from where it is, with no restart.
    if (frame.current) return;
    let last = performance.now();
    const step = (now: number) => {
      const ms = Math.max(0, Math.min(48, now - last));
      last = now;
      const to = goal.current;
      const at = current.current;
      // Each frame closes the same share of what is left (an exponential ease-out): it never overshoots,
      // and a new wheel notch mid-glide only moves the goal, so the motion stays one smooth curve.
      const k = 1 - Math.exp(-ms / GLIDE_MS);
      const next = {
        zoom: at.zoom * (to.zoom / at.zoom) ** k,
        x: at.x + (to.x - at.x) * k,
        y: at.y + (to.y - at.y) * k,
      };
      const near = Math.abs(Math.log(to.zoom / next.zoom)) < 0.001 && Math.abs(to.x - next.x) < 0.3 && Math.abs(to.y - next.y) < 0.3;
      current.current = near ? to : next;
      setShown(current.current);
      frame.current = near ? 0 : requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the target's three numbers are the dependency
  }, [target.zoom, target.x, target.y, glide]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return shown;
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

const pairOf = (touches: TouchList, rect: DOMRect): [Point, Point] => [
  { x: touches[0]!.clientX - rect.left, y: touches[0]!.clientY - rect.top },
  { x: touches[1]!.clientX - rect.left, y: touches[1]!.clientY - rect.top },
];

export type MapProps = {
  ledger: Ledger;
  layout: LayoutKind | null;
  everywhere: Place[];
  places: Place[];
  selectedId: string | null;
  hoverId: string | null;
  heat: boolean;
  move: MapMove;
  onView: (view: MapView, glide: boolean) => void;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
  onHeat: (heat: boolean) => void;
  satellite: boolean;
  onSatellite: (satellite: boolean) => void;
  emptyLine: string;
  locationOff: boolean;
};

/**
 * The Google map with a pin per place by its coordinates. It moves the way Google's own map does: a mouse
 * drags it anywhere and a fling keeps it sliding, the wheel and a trackpad pinch zoom about the pointer, a
 * double click zooms in (Shift out), and on touch two fingers pan and pinch while one finger scrolls the
 * page, so the page below never traps a thumb. Gestures, Zoom and Fit move the map's camera and the pins
 * together; pins whose capsules touch at the current zoom merge into one with a count.
 */
export function PlaceMap({ ledger, layout, everywhere, places, selectedId, hoverId, heat, move, onView, onPick, onHover, onHeat, satellite, onSatellite, emptyLine, locationOff }: MapProps) {
  const [ref, box] = useBox();
  const currency = ledger.currency as CurrencyCode;
  const google = useMapsUsable();
  const [floats, setFloats] = useState<Float[]>([]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !box) return;
    const map = element.getBoundingClientRect();
    setFloats(
      [...element.querySelectorAll(':scope > .map-views, :scope > .map-layer, :scope > .map-zoom')].map((float) => {
        const rect = float.getBoundingClientRect();
        return { left: rect.left - map.left, top: rect.top - map.top, right: rect.right - map.left, bottom: rect.bottom - map.top };
      }),
    );
  }, [ref, box, layout, google]);
  const widest = pinWidth(formatMoney(everywhere.reduce((top, place) => Math.max(top, place.totalMinor), 0), currency, { whole: true }), 1);
  const frame = useMemo(
    () => (box ? fitFrame(everywhere, box, clearOfFloats(insetsFor(layout), box, floats, { width: widest, height: PIN_ROW })) : null),
    [box, everywhere, layout, floats, widest],
  );
  const fitted = frame?.project;
  const limits: ZoomLimits = frame ? zoomLimits(googleZoom(frame.pxPerLngDegree)) : DEFAULT_LIMITS;
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(false);
  const target = move.view;
  const view = useSlidingView(target, move.glide);
  const at = (place: Place) => (fitted && box ? toView(fitted(place), view, box) : { x: 0, y: 0 });
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  const widthOf = (total: number, members: number, discs: number) => pinWidth(whole(total), members, discs);
  // Pins group by where the camera is going, so they merge or split once per move, not on every frame of it.
  const clusters = fitted && box ? clusterPins(places, (point) => toView(fitted(point), target, box), widthOf, PIN_ROW) : [];
  const leadOf = new Map(clusters.flatMap((cluster) => cluster.members.map((member) => [member.id, cluster] as const)));
  const max = places.reduce((top, place) => Math.max(top, place.totalMinor), 0);

  // The native listeners (a wheel and touches the page must not also take) read the latest of these. A
  // gesture writes its view here at once, so a second event before React renders builds on the first.
  const live = useRef({ target, box, limits, onView });
  useLayoutEffect(() => {
    live.current = { target, box, limits, onView };
  });
  const go = (next: MapView, glide: boolean) => {
    live.current.target = next;
    live.current.onView(next, glide);
  };

  const fling = useRef(0);
  const startFling = (speed: Point) => {
    if (reduced() || Math.hypot(speed.x, speed.y) < 0.3) return;
    let last = performance.now();
    let now = speed;
    const step = (time: number) => {
      const ms = Math.min(48, time - last);
      last = time;
      now = flingSpeed(now, ms);
      const size = live.current.box;
      if (!size || Math.hypot(now.x, now.y) < 0.02) return;
      go(panView(live.current.target, { x: now.x * ms, y: now.y * ms }, size), false);
      fling.current = requestAnimationFrame(step);
    };
    fling.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(fling.current), []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const { box: size, limits: range } = live.current;
      if (!size || event.deltaY === 0) return;
      event.preventDefault();
      cancelAnimationFrame(fling.current);
      const rect = element.getBoundingClientRect();
      const focus = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      go(zoomView(live.current.target, wheelFactor(event.deltaY, event.deltaMode, event.ctrlKey), focus, size, range), wheelGlides(event.deltaY, event.deltaMode));
    };
    let pinch: { from: [Point, Point]; view: MapView } | null = null;
    let hintTimer = 0;
    // Fingers land one at a time, and a touchstart can't be cancelled while the page still glides, so
    // the pinch also starts on the first move that has two fingers.
    const startPinch = (event: TouchEvent) => {
      cancelAnimationFrame(fling.current);
      setHint(false);
      pinch = { from: pairOf(event.touches, element.getBoundingClientRect()), view: live.current.target };
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      if (event.cancelable) event.preventDefault();
      startPinch(event);
    };
    const onTouchMove = (event: TouchEvent) => {
      const { box: size, limits: range } = live.current;
      if (event.touches.length >= 2 && size && event.cancelable) {
        event.preventDefault();
        if (!pinch) startPinch(event);
        go(pinchView(pinch!.view, pinch!.from, pairOf(event.touches, element.getBoundingClientRect()), size, range), false);
      } else if (!pinch && event.touches.length === 1) {
        setHint(true);
        window.clearTimeout(hintTimer);
        hintTimer = window.setTimeout(() => setHint(false), 1400);
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null;
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.clearTimeout(hintTimer);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the listeners read `live`, so they bind once
  }, []);

  const ready = Boolean(fitted && box);
  // A picked place (a pin, a row, J or K, Back) comes into view: the map stays put when its pin already
  // sits well inside on its own, else it glides to centre it, zooming in until a merged pin comes apart.
  useEffect(() => {
    const place = places.find((each) => each.id === selectedId);
    if (!place || !fitted || !box) return;
    const alone = (zoom: number) =>
      clusterPins(places, (point) => toView(fitted(point), { zoom, x: 0, y: 0 }, box), widthOf, PIN_ROW).find((cluster) => cluster.members.some((member) => member.id === place.id))?.members.length === 1;
    const current = live.current.target;
    const next = viewForPick(current, fitted(place), box, alone, live.current.limits);
    if (next !== current) go(next, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new pick moves the map
  }, [selectedId, ready]);

  const drag = useRef<{ id: number; x: number; y: number; view: MapView; moved: boolean; trail: { t: number; x: number; y: number }[] } | null>(null);
  const swallowClick = useRef(false);
  const zoom = (factor: number) => {
    if (!box) return;
    const selected = places.find((place) => place.id === selectedId);
    go(zoomView(target, factor, selected ? at(selected) : { x: box.width / 2, y: box.height / 2 }, box, limits), true);
  };
  const pick = (id: string) => onPick(leadOf.get(id)?.lead.id ?? id);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (event.pointerType === 'touch' || event.button !== 0 || (event.target as HTMLElement).closest('.map-float, .map-banner, .map-note, a')) return;
    cancelAnimationFrame(fling.current);
    // From where the map shows now: a press during a glide stops it there, as Google's map does.
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view, moved: false, trail: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }] };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !box) return;
    const by = { x: event.clientX - start.x, y: event.clientY - start.y };
    if (!start.moved) {
      if (Math.hypot(by.x, by.y) < DRAG_SLOP) return;
      start.moved = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    start.trail = [...start.trail.filter((point) => event.timeStamp - point.t < 80), { t: event.timeStamp, x: event.clientX, y: event.clientY }];
    go(panView(start.view, by, box), false);
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (!start.moved) return;
    swallowClick.current = true;
    setDragging(false);
    const first = start.trail[0]!;
    const ms = event.timeStamp - first.t;
    if (event.type === 'pointerup' && ms > 0 && ms < 120) startFling({ x: (event.clientX - first.x) / ms, y: (event.clientY - first.y) / ms });
  };
  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!box || (event.target as HTMLElement).closest('button, a')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    go(zoomView(live.current.target, event.shiftKey ? 0.5 : 2, { x: event.clientX - rect.left, y: event.clientY - rect.top }, box, limits), true);
  };

  return (
    <div
      ref={ref}
      className="places-map"
      data-heat={heat || undefined}
      data-zoom={target.zoom}
      data-shown-zoom={view.zoom}
      data-faded={locationOff || undefined}
      data-dragging={dragging || undefined}
      data-google={google || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      <MapGround frame={frame} view={view} box={box} satellite={satellite} />
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
          const { x, y } = at(lead ? place : (cluster?.lead ?? place));
          // A pin cut by the map's edge or a control hides, judged where the camera is going so it hides once per move.
          const goal = fitted ? toView(fitted(place), target, box) : { x, y };
          const width = widthOf(cluster?.totalMinor ?? place.totalMinor, members.length, Math.max(1, Math.min((cluster?.categories ?? place.categories).length, 3)));
          const covered = !on && !pinClear(goal, { width, height: PIN_ROW }, box, floats);
          const shown = lead && !covered && (!heat || on || hot);
          const names = members.map((member) => member.name).join(' and ');
          return (
            <button
              key={place.id}
              type="button"
              className="map-pin-big"
              data-place={place.id}
              data-shown={shown || undefined}
              data-clipped={(lead && covered) || undefined}
              data-on={(shown && on) || undefined}
              data-hot={(shown && hot && !on) || undefined}
              data-dim={(shown && selectedId !== null && !on && !hot) || undefined}
              aria-hidden={!shown}
              aria-pressed={shown ? on : undefined}
              tabIndex={shown ? 0 : -1}
              aria-label={`${names}, ${formatMoney(cluster?.totalMinor ?? place.totalMinor, currency)}`}
              style={{ left: x, top: y }}
              onClick={() => pick(place.id)}
              onMouseEnter={() => onHover(place.id)}
              onMouseLeave={() => onHover(null)}
            >
              <span className="pin-body">
                <PinBubbles ledger={ledger} categories={cluster?.categories ?? place.categories} />
                <span className="num pin-amount">{whole(cluster?.totalMinor ?? place.totalMinor)}</span>
                {members.length > 1 && <span className="num pin-count">{members.length}</span>}
              </span>
            </button>
          );
        })}
      <div className="map-hint" data-on={hint || undefined} aria-hidden="true">
        Use two fingers to move the map
      </div>
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
      {google ? (
          <button
            type="button"
            className="map-float map-btn map-layer press"
            aria-pressed={satellite}
            aria-label="Satellite view"
            title={satellite ? 'Back to the map (S)' : 'Satellite view (S)'}
            onClick={() => onSatellite(!satellite)}
          >
            <Mdi name="layers-outline" size={22} />
          </button>
        ) : null}
      <div className="map-zoom">
        <button type="button" className="map-float map-btn map-fit press" title="Fit every place" onClick={() => go(FIT, true)}>
          <Mdi name="fit-to-screen-outline" size={20} />
          <span>Fit</span>
          <span className="kbd" data-only="sidebar rail rail-one-column">
            F
          </span>
        </button>
        <span className="map-float map-zoom-pair">
          <button type="button" className="map-btn" aria-label="Zoom in" disabled={target.zoom >= limits.max} onClick={() => zoom(1.5)}>
            <Mdi name="plus" size={22} />
          </button>
          <span className="map-zoom-rule" aria-hidden="true" />
          <button type="button" className="map-btn" aria-label="Zoom out" disabled={target.zoom <= limits.min} onClick={() => zoom(1 / 1.5)}>
            <Mdi name="minus" size={22} />
          </button>
        </span>
      </div>
    </div>
  );
}

/** A pin's categories as overlapping bubbles, largest first, the last slot "+N" past three. */
function PinBubbles({ ledger, categories }: { ledger: Ledger; categories: readonly PlaceCategory[] }) {
  const { shown, more } = pinMix(categories);
  return (
    <span className="pin-bubbles">
      {shown.map(({ categoryId }) => {
        const category = projectionCategory(ledger, categoryId);
        return <Bubble key={categoryId ?? 'none'} icon={category?.icon} color={category?.color ?? null} size={28} glyph={16} />;
      })}
      {more > 0 && <span className="bubble num pin-more">+{more}</span>}
    </span>
  );
}

export function projectionCategory(ledger: Ledger, id: string | null) {
  return id ? ledger.projection.categoriesById[id] : undefined;
}
