'use client';

import { formatMoney, placeByDay, type Place, type PlaceDay } from '@repo/core';
import { legacyColor } from '@repo/types';
import { useMemo, type CSSProperties } from 'react';
import { Bubble } from '@/components/ledger/glyph';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { projectionCategory } from './place-map';

type GridProps = {
  ledger: Ledger;
  places: Place[];
  days: PlaceDay[];
  rangeLabel: string;
  emptyLine: string;
  litId: string | null;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
};

/** Day by day: a row per place, a column per day, a dot sized by what was spent there that day. */
export function DayGrid({ ledger, places, days, rangeLabel, emptyLine, litId, onPick, onHover }: GridProps) {
  const { currency, calendar } = ledger;
  const totals = useMemo(() => places.map((place) => placeByDay(place, calendar)), [places, calendar]);
  const max = Math.max(1, ...totals.flatMap((byDay) => Object.values(byDay).map((day) => day.totalMinor)));
  const big = days.length <= 14;
  const crowded = days.length > 31;
  const columns = { '--days': days.length } as CSSProperties;
  return (
    <section aria-label="Day by day" className="card day-grid-card" data-only="sidebar rail rail-one-column">
      <div className="card-head">
        <h2 className="card-title">Day by day</h2>
        <span className="meta">Weekends shaded, {rangeLabel}</span>
      </div>
      <div className="day-grid" style={columns}>
        <div className="day-axis" aria-hidden="true">
          <span />
          <span className="day-cols">
            {days.map((day, at) => {
              const last = at === days.length - 1;
              const shown = !crowded || day.month !== null || last || at % 7 === 0;
              return (
                <span key={day.day} className="day-col" data-weekend={day.weekend || undefined} data-today={last || undefined}>
                  <span className="day-month">{last ? 'Today' : day.month}</span>
                  <span className="num day-num" data-every-other={(days.length - 1 - at) % 2 === 1 || at === days.length - 3 || undefined}>
                    {last || !shown ? '' : day.date}
                  </span>
                </span>
              );
            })}
          </span>
          <span className="caps day-spent">Spent</span>
        </div>
        {places.map((place, row) => {
          const category = projectionCategory(ledger, place.categories[0]?.categoryId ?? null);
          return (
            <button
              key={place.id}
              type="button"
              className="day-row"
              data-place={place.id}
              aria-current={litId === place.id || undefined}
              onClick={() => onPick(place.id)}
              onMouseEnter={() => onHover(place.id)}
              onMouseLeave={() => onHover(null)}
            >
              <span className="day-name">
                <Bubble icon={category?.icon} color={category?.color ?? null} size={24} glyph={14} />
                <span>{place.name}</span>
              </span>
              <span className="day-cols">
                {days.map((day) => {
                  const value = totals[row]![day.day];
                  const dotColor = projectionCategory(ledger, value?.categoryId ?? null)?.color;
                  const size = value ? Math.round((big ? 10 : 8) + (big ? 16 : 10) * Math.sqrt(value.totalMinor / max)) : 0;
                  return (
                    <span key={day.day} className="day-cell" data-weekend={day.weekend || undefined} title={value ? `${formatMoney(value.totalMinor, currency)} at ${place.name} on ${day.date}${day.month ? ` ${day.month}` : ''}` : undefined}>
                      {value && <span className="day-dot" data-day={day.day} style={{ width: size, height: size, ['--dot' as string]: dotColor ? legacyColor(dotColor) : undefined }} />}
                    </span>
                  );
                })}
              </span>
              <span className="num day-amount">{formatMoney(place.totalMinor, currency)}</span>
            </button>
          );
        })}
        {places.length === 0 && <p className="meta day-empty">{emptyLine}</p>}
      </div>
    </section>
  );
}
