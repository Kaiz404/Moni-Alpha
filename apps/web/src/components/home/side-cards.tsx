'use client';

import { firstDayOf, formatMoney, groupPlaces, nextDays, summarizeDebts, type FinanceDebtActivity } from '@repo/core';
import { miniMapStyles } from '@repo/design';
import Link from 'next/link';
import { useMemo } from 'react';
import { Icon } from '@/components/icon';
import { useSize } from '@/components/ledger/chart-parts';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { useMapsUsable } from '@/components/places/map-ground';
import { useTheme } from '@/components/use-theme';
import { MAPS_KEY, staticCover, staticFrame, staticMapUrl } from '@/lib/google-maps';
import type { Ledger } from '@/lib/ledger/use-ledger';

/** "Next 14 days": a timeline strip of what's due, then each bill and debt (W2-Home). */
export function NextDaysCard({ ledger }: { ledger: Ledger }) {
  const { money, projection, now, calendar, currency } = ledger;
  const next = useMemo(() => {
    const activities = Object.values(projection.debtActivitiesById) as FinanceDebtActivity[];
    const debts = summarizeDebts(Object.values(projection.debtsById).filter((debt) => debt.userId === ledger.userId), activities, now, currency, calendar);
    return nextDays({ bills: money.bills, comingUp: debts.comingUp, today: calendar.dayKey(now), currency });
  }, [money.bills, projection, now, currency, calendar, ledger.userId]);
  const today = calendar.dayKey(now);
  const label = (offset: number) => {
    const day = new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000);
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()]} ${day.getUTCDate()}`;
  };
  return (
    <section aria-label="Next 14 days" className="card next-card" data-card="next">
      <div className="next-head">
        <h2 className="card-title">Next 14 days</h2>
        {next.items.length > 0 && <span className="meta num">{formatMoney(next.setAsideMinor, currency)}, set aside</span>}
      </div>
      {next.items.length === 0 ? (
        <div className="tile-empty tile-empty-row">
          <span className="tile-empty-icon">
            <Glyph name="calendar-clock" size={20} />
          </span>
          <span className="row-text">
            <strong>No bills yet</strong>
            <span>Each bill shows here a few days before it&apos;s due.</span>
          </span>
        </div>
      ) : (
        <>
          <div className="timeline" aria-hidden="true">
            <span className="timeline-line" />
            {Array.from({ length: 15 }, (_, index) => (
              <span key={index} className="timeline-tick" data-week={index % 7 === 0 || undefined} style={{ left: `calc(8px + (100% - 16px) * ${index / 14})` }} />
            ))}
            <span className="timeline-dot timeline-today" style={{ left: 2 }} />
            {next.items.map((item) => {
              const category = item.categoryId ? projection.categoriesById[item.categoryId] : undefined;
              return (
                <span
                  key={item.key}
                  className="timeline-dot"
                  data-kind={item.kind}
                  style={{ left: `calc(8px + (100% - 16px) * ${item.offset / 14} - 6px)`, background: item.kind === 'bill' ? (category?.color ?? undefined) : undefined }}
                />
              );
            })}
            <span className="timeline-label" data-today="true" style={{ left: 0 }}>
              Today
            </span>
            <span className="timeline-label" style={{ left: 'calc(50% - 30px)', width: 60, textAlign: 'center' }}>
              {label(7)}
            </span>
            <span className="timeline-label" style={{ right: 0 }}>
              {label(14)}
            </span>
          </div>
          <ul className="next-rows">
            {next.items.slice(0, 4).map((item) => {
              const category = item.categoryId ? projection.categoriesById[item.categoryId] : undefined;
              return (
                <li key={item.key} className="next-row" data-tomorrow={item.when === 'Tomorrow' || undefined}>
                  <span className="next-when">{item.when}</span>
                  {item.kind === 'bill' ? (
                    <Bubble icon={category?.icon ?? 'calendar-clock'} color={category?.color ?? null} size={26} glyph={14} />
                  ) : (
                    <span className="initial-bubble">{item.name.split(' ')[1]?.charAt(0) ?? '?'}</span>
                  )}
                  <span className="next-name">{item.name}</span>
                  <span className="num next-amount">{formatMoney(item.amountMinor, currency)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {next.items[0] && (
        <p className="bills-strip" data-only="phone">
          {next.items[0].name} {formatMoney(next.items[0].amountMinor, currency)} is due {next.items[0].when === 'Tomorrow' ? 'tomorrow' : next.items[0].when === 'Today' ? 'today' : `on ${next.items[0].when}`}
        </p>
      )}
    </section>
  );
}

/** Static Maps sizes step by 40 px, so a small resize asks for the same image again from the cache. */

/**
 * Where you spend: a Maps Static API image of this month's three biggest places with their pins drawn on
 * top, styled like the phone's mini map. It is one image, not a live map, because Home loads far more
 * often than the map page. The whole tile opens the map.
 */
export function PlacesCard({ ledger }: { ledger: Ledger }) {
  const { transactions, currency, calendar, now, projection } = ledger;
  const places = useMemo(
    () =>
      groupPlaces(transactions, { currency, range: { from: firstDayOf(calendar.monthKey(now)), to: calendar.dayKey(now) } }, calendar).slice(0, 3),
    [transactions, currency, calendar, now],
  );
  const [ref, size] = useSize<HTMLAnchorElement>();
  const usable = useMapsUsable();
  const dark = useTheme().resolved === 'dark';
  const { width, height, zoom } = staticCover(size.width, size.height);
  const frame = width > 0 && height > 0 && places.length ? staticFrame(places.map((place) => ({ lat: place.latitude, lng: place.longitude })), width, height, 36 / zoom) : null;
  const offset = { x: (size.width - width * zoom) / 2, y: (size.height - height * zoom) / 2 };
  return (
    <section aria-label="Where you spend" className="card places-card" data-card="map">
      <div className="section-head">
        <h2 className="card-title">Where you spend</h2>
        {places.length > 0 && (
          <Link href="/home/places" className="see-all">
            Open map
            <Icon name="chevron-right" size={18} />
          </Link>
        )}
      </div>
      {places.length === 0 ? (
        <div className="tile-empty tile-empty-row">
          <span className="tile-empty-icon">
            <Glyph name="map-marker-outline" size={20} />
          </span>
          <span className="row-text">
            <strong>No places yet</strong>
            <span>Pay somewhere with location on and it lands here.</span>
          </span>
        </div>
      ) : (
        <Link
          ref={ref}
          href="/home/places"
          className="mini-map press"
          aria-label={`Open map: ${places.map((place) => `${place.name}, ${formatMoney(place.totalMinor, currency, { whole: true })}`).join('; ')}`}
        >
          {usable && frame && MAPS_KEY ? (
            // eslint-disable-next-line @next/next/no-img-element -- a Google image, sized by the request itself
            <img
              className="mini-map-image"
              alt=""
              width={width * zoom}
              height={height * zoom}
              style={{ left: offset.x, top: offset.y }}
              src={staticMapUrl({ key: MAPS_KEY, center: frame.center, zoom: frame.zoom, width, height, styles: dark ? miniMapStyles.dark : miniMapStyles.light })}
            />
          ) : (
            <span className="map-unavailable">Map unavailable</span>
          )}
          {frame &&
            places.map((place) => {
              const category = place.categories[0]?.categoryId ? projection.categoriesById[place.categories[0].categoryId] : undefined;
              const at = frame.at({ lat: place.latitude, lng: place.longitude });
              return (
                <span key={place.id} className="map-pin" style={{ left: at.x * zoom + offset.x, top: at.y * zoom + offset.y }} title={place.name}>
                  <Bubble icon={category?.icon} color={category?.color ?? null} size={26} glyph={15} />
                  <span className="num">{formatMoney(place.totalMinor, currency, { whole: true })}</span>
                </span>
              );
            })}
        </Link>
      )}
    </section>
  );
}
