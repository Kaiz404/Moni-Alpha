'use client';

import { mdiCar, mdiCart, mdiMapMarkerOutline, mdiShopping, mdiSilverwareForkKnife } from '@mdi/js';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MapArt } from './map-art';
import { useMoment } from './moment';
import { MdiIcon } from './parts';

type Tone = 'mint' | 'peach' | 'coral' | 'sky';

type Place = {
  name: string;
  meta: string;
  amount: string;
  pinAmount: string;
  icon: string;
  tone: Tone;
  /** The pin's centre on the 796 by 480 map. */
  x: number;
  y: number;
};

const PLACES: readonly Place[] = [
  { name: 'Bangsar', meta: 'Groceries, Food · 6 visits', amount: 'RM293.80', pinAmount: 'RM293', icon: mdiCart, tone: 'mint', x: 401.8, y: 286.4 },
  { name: 'Mid Valley', meta: 'Shopping, Food +2 · 4 visits', amount: 'RM241.10', pinAmount: 'RM241', icon: mdiShopping, tone: 'peach', x: 447.3, y: 377.7 },
  { name: 'Home, Bangsar South', meta: 'Food · 3 visits', amount: 'RM106.10', pinAmount: 'RM106', icon: mdiSilverwareForkKnife, tone: 'coral', x: 361.3, y: 426.2 },
  { name: 'SS2, Petaling Jaya', meta: 'Groceries, Food · 2 visits', amount: 'RM74.00', pinAmount: 'RM74', icon: mdiCart, tone: 'mint', x: 44.1, y: 368.7 },
  { name: 'TTDI', meta: 'Transport · 1 visit', amount: 'RM60.00', pinAmount: 'RM60', icon: mdiCar, tone: 'sky', x: 92.6, y: 216.5 },
];

/** Places outside the top five: plain dots. */
const SPOTS: readonly { x: number; y: number }[] = [
  { x: 705.8, y: 81 },
  { x: 515.8, y: 257 },
  { x: 694.8, y: 164.3 },
  { x: 48.5, y: 242.2 },
];

const LABELS = [
  { x: 433.5, y: 15, text: 'KUALA LUMPUR', kind: 'city' },
  { x: 261, y: 107, text: 'SRI HARTAMAS', kind: 'area' },
  { x: 504.8, y: 185.2, text: 'Lake Gardens', kind: 'park' },
  { x: 606, y: 341.6, text: 'BRICKFIELDS', kind: 'area', start: true },
] as const;

/** The board's playMap: light the top three in turn, then let go. Times from the moment's start, in ms. */
const PLAY: readonly [number, number | null][] = [
  [0, 0],
  [650, 1],
  [1300, 2],
  [2100, null],
];

const pct = (value: number, of: number) => `${(value / of) * 100}%`;

/** The landing map: pointing at a place in the list, or at its pin, lights the pin and dims the rest. */
export function MapPlaces() {
  const { playing } = useMoment();
  const [lit, setLit] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!playing) return;
    timers.current = PLAY.map(([ms, index]) => setTimeout(() => setLit(index), ms));
    return () => timers.current.forEach(clearTimeout);
  }, [playing]);

  const point = (index: number | null) => {
    timers.current.forEach(clearTimeout);
    setLit(index);
  };
  const onMouse = (index: number | null) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') point(index);
  };

  return (
    <div className="mp-stage">
      <div className="mp-map" aria-hidden="true" data-lit={lit !== null}>
        <div className="mp-art">
          <MapArt />
        </div>
        <svg className="mp-labels" viewBox="0 0 796 480">
          {LABELS.map((label) => (
            <text key={label.text} x={label.x} y={label.y} textAnchor={'start' in label ? 'start' : 'middle'} className={`mp-label mp-label-${label.kind}`}>
              {label.text}
            </text>
          ))}
        </svg>
        {SPOTS.map((spot) => (
          <span key={`${spot.x},${spot.y}`} className="mp-spot" style={{ left: pct(spot.x, 796), top: pct(spot.y, 480) }} />
        ))}
        {PLACES.map((place, index) => (
          <span
            key={place.name}
            className="mp-pin"
            data-lit={lit === index}
            data-dim={lit !== null && lit !== index}
            style={{ left: pct(place.x, 796), top: pct(place.y, 480) }}
            onPointerEnter={onMouse(index)}
            onPointerLeave={onMouse(null)}
            onClick={() => point(index)}
          >
            <span className={`mp-bubble mp-${place.tone}`}>
              <MdiIcon path={place.icon} size={15} />
            </span>
            <span className="num">{place.pinAmount}</span>
          </span>
        ))}
      </div>
      <div className="mp-list">
        <div className="mp-list-head">
          <h3>Top places</h3>
          <span>This month</span>
        </div>
        <ul>
          {PLACES.map((place, index) => (
            <li key={place.name}>
              <button
                type="button"
                className="mp-row"
                aria-pressed={lit === index}
                onPointerEnter={onMouse(index)}
                onPointerLeave={onMouse(null)}
                onFocus={() => point(index)}
                onBlur={() => point(null)}
                onClick={() => point(index)}
              >
                <span className={`mp-bubble mp-bubble-row mp-${place.tone}`}>
                  <MdiIcon path={place.icon} size={20} />
                </span>
                <span className="mp-row-text">
                  <span className="mp-row-name">{place.name}</span>
                  <span className="mp-row-meta">{place.meta}</span>
                </span>
                <span className="mp-row-amount num">{place.amount}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mp-note">
          <MdiIcon path={mdiMapMarkerOutline} size={18} />
          Moni reads your location only when you add something or a payment arrives. Turn it off for any wallet.
        </p>
      </div>
    </div>
  );
}
