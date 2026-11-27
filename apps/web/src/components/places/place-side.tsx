'use client';

import { formatMoney, merchantName, placeByDay, placesTotal, sharePercent, type Place } from '@repo/core';
import { legacyColor, type MinorAmount } from '@repo/types';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bubble } from '@/components/ledger/glyph';
import { rowDay } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { hotSpot, placeMeta, placeSub, visitColumns, type PlacesQuery } from '@/lib/places-view';
import { Mdi } from './mdi';
import { projectionCategory } from './place-map';
import type { PlacesData } from './use-places';

type SideProps = {
  ledger: Ledger;
  data: PlacesData;
  hoverId: string | null;
  onPick: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onSort: (sort: PlacesQuery['sort']) => void;
  categoryWords: string;
};

type CardProps = SideProps & {
  selected: Place | null;
  onClose: () => void;
  onStep: (by: 1 | -1) => void;
};

/**
 * The card beside the map (W2-Places), as Google Maps' side panel: the places list, or a picked place in
 * its place, sliding over the list on the sheet spring while the map stays live. "‹ All places" and Esc
 * go back to the list where it was scrolled; the chevrons, J and K step through the places. The list
 * stays mounted under the place, so its scroll and filters wait for the way back.
 */
export function PlaceSide({ selected, onClose, onStep, ...props }: CardProps) {
  const [last, setLast] = useState(selected);
  if (selected && selected !== last) setLast(selected);
  const shown = selected ?? last;
  const card = useRef<HTMLElement>(null);
  const { places } = props.data;
  const index = shown ? places.indexOf(shown) : -1;

  // A place picked from lower down (a long list under the map, Day by day) opens with the card's top in
  // view, and going back returns the page to where the pick was made.
  const pickedAt = useRef<number | null>(null);
  const open = Boolean(selected);
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (open) {
      pickedAt.current ??= window.scrollY;
      if (element.getBoundingClientRect().top < 0) element.scrollIntoView({ block: 'start', behavior });
    } else if (pickedAt.current !== null) {
      window.scrollTo({ top: pickedAt.current, behavior: 'auto' });
      pickedAt.current = null;
    }
  }, [open, selected]);

  return (
    <aside ref={card} aria-label="Places" className="card places-side" data-detail={selected ? true : undefined}>
      <div className="side-panel side-places" inert={Boolean(selected)}>
        <PlacesList {...props} />
      </div>
      {shown && (
        <section className="side-panel side-detail" aria-label={shown.name} inert={!selected}>
          <div className="side-detail-head">
            <button type="button" className="side-back press" aria-label="Back to all places (Esc)" onClick={onClose}>
              <Mdi name="chevron-left" size={20} />
              All places
              <span className="kbd" data-only="sidebar rail rail-one-column">
                Esc
              </span>
            </button>
            {index >= 0 && places.length > 1 && (
              <span className="side-steps">
                <span className="meta num">
                  {index + 1} of {places.length}
                </span>
                <button type="button" className="icon-round icon-round-key side-step press" aria-label="Previous place (K)" disabled={index === 0} onClick={() => onStep(-1)}>
                  <Mdi name="chevron-up" size={20} />
                  <span className="kbd kbd-inline">K</span>
                </button>
                <button type="button" className="icon-round icon-round-key side-step press" aria-label="Next place (J)" disabled={index === places.length - 1} onClick={() => onStep(1)}>
                  <Mdi name="chevron-down" size={20} />
                  <span className="kbd kbd-inline">J</span>
                </button>
              </span>
            )}
          </div>
          <div className="side-detail-body" key={shown.id}>
            <PlacePane ledger={props.ledger} data={props.data} place={shown} categoryWords={props.categoryWords} />
          </div>
        </section>
      )}
    </aside>
  );
}

function PlacesList({ ledger, data, hoverId, onPick, onHover, onSort, categoryWords }: SideProps) {
  const { places, loose, query, range } = data;
  const currency = ledger.currency;
  const total = placesTotal(places);
  const max = places.reduce((top, place) => Math.max(top, place.totalMinor), 0);
  const looseTotal = loose.reduce((sum, transaction) => sum + transaction.amountMinor, 0) as MinorAmount;
  const categoryName = (id: string | null) => projectionCategory(ledger, id)?.name ?? 'Other';
  return (
    <div className="side-list fade-swap">
      <div className="side-summary">
        <span className="caps">Spent at places</span>
        <div className="side-hero-line">
          <span className="side-hero num" data-testid="places-total">
            {formatMoney(total, currency)}
          </span>
          <span className="side-hero-of">
            at {places.length} {places.length === 1 ? 'place' : 'places'}
          </span>
        </div>
        <p className="side-sentence">{places.length ? hotSpot(places) : `Nothing${categoryWords} with a place ${range.words}.`}</p>
      </div>
      <div className="side-list-head">
        <span className="caps">Places</span>
        <span className="pseg pseg-sm" role="radiogroup" aria-label="Sort places">
          <span className="pseg-pill" aria-hidden="true" style={{ transform: `translateX(${query.sort === 'visits' ? 100 : 0}%)` }} />
          <button type="button" role="radio" aria-checked={query.sort === 'spent'} onClick={() => onSort('spent')}>
            Spent
          </button>
          <button type="button" role="radio" aria-checked={query.sort === 'visits'} onClick={() => onSort('visits')}>
            Visits
          </button>
        </span>
      </div>
      <ul className="place-rows">
        {places.map((place) => {
          const category = projectionCategory(ledger, place.categories[0]?.categoryId ?? null);
          return (
            <li key={place.id}>
              <button
                type="button"
                className="place-row"
                data-place={place.id}
                aria-current={hoverId === place.id || undefined}
                onClick={() => onPick(place.id)}
                onMouseEnter={() => onHover(place.id)}
                onMouseLeave={() => onHover(null)}
              >
                <Bubble icon={category?.icon} color={category?.color ?? null} size={38} glyph={20} />
                <span className="row-text">
                  <span className="row-title">{place.name}</span>
                  <span className="row-meta">{placeMeta(place, categoryName)}</span>
                </span>
                <span className="place-amount">
                  <span className="num">{formatMoney(place.totalMinor, currency)}</span>
                  <span className="place-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(6, Math.round((place.totalMinor / (max || 1)) * 100))}%` }} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {loose.length > 0 && (
        <a href="#without" className="no-place-foot press" data-only="sidebar rail rail-one-column">
          <span className="no-place-icon">
            <Mdi name="map-marker-off-outline" size={19} />
          </span>
          <span className="row-text">
            <span className="row-title">
              {loose.length} {loose.length === 1 ? 'expense' : 'expenses'} without a place
            </span>
            <span className="row-meta">Add places below</span>
          </span>
          <span className="num place-foot-amount">{formatMoney(looseTotal, currency)}</span>
          <Mdi name="arrow-down" size={18} />
        </a>
      )}
    </div>
  );
}

/** A place in the side card: what it cost, by day, what you bought and each payment. */
function PlacePane({ ledger, data, place, categoryWords }: { ledger: Ledger; data: PlacesData; place: Place; categoryWords: string }) {
  const { places, days, range, query } = data;
  const { currency, calendar, now } = ledger;
  const index = places.indexOf(place);
  const columns = visitColumns(days, placeByDay(place, calendar));
  const columnMax = Math.max(1, ...columns.map((column) => column.totalMinor));
  const lead = projectionCategory(ledger, place.categories[0]?.categoryId ?? null);
  const each = Math.round(place.totalMinor / place.count) as MinorAmount;
  const top = query.sort === 'spent' && index === 0 && places.length > 1;
  const maps = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}${place.id.includes(',') ? '' : `&query_place_id=${encodeURIComponent(place.id)}`}`;
  return (
    <div className="place-pane">
      <div className="pane-title-row">
        <Bubble icon={lead?.icon} color={lead?.color ?? null} size={48} glyph={24} />
        <div className="pane-title-text">
          <h2>{place.name}</h2>
          <span className="meta">{placeSub(place)}</span>
        </div>
      </div>
      <div className="pane-amount-row">
        <span className="pane-amount num">{formatMoney(place.totalMinor, currency)}</span>
        <span className="num pane-each">{formatMoney(each, currency)} each</span>
      </div>
      <span className="pane-share">
        {top ? 'Your top place, ' : ''}
        {sharePercent(place.totalMinor, placesTotal(places))}% of your spending{categoryWords} at places
      </span>
      <section className="pane-section" aria-label="Visits by day">
        <span className="caps">By day, {range.label}</span>
        <div className="visit-bars" style={{ gap: columns.length > 30 ? 1 : columns.length > 14 ? 3 : 6 }}>
          {columns.map((column, at) => {
            const height = column.totalMinor ? Math.max(6, Math.round((46 * column.totalMinor) / columnMax)) : 0;
            const category = projectionCategory(ledger, column.categoryId);
            const topEdge = at < columns.length / 5 ? 'start' : at >= (columns.length * 4) / 5 ? 'end' : undefined;
            return (
              <span key={column.key} className="visit-col" title={column.totalMinor ? `${formatMoney(column.totalMinor, currency)}, ${column.name}` : undefined}>
                <span className="visit-bar grow" style={{ height, ['--bar' as string]: category?.color ? legacyColor(category.color) : undefined }}/>
                {column.totalMinor > 0 && column.totalMinor === columnMax && <span className="num visit-top" data-edge={topEdge}>{formatMoney(column.totalMinor, currency)}</span>}
                <span className="visit-tick" data-edge={at === 0 ? 'start' : at === columns.length - 1 ? 'end' : undefined}>
                  {column.tick ?? ''}
                </span>
              </span>
            );
          })}
        </div>
      </section>
      <section className="pane-section" aria-label="What you bought">
        <span className="caps">What you bought</span>
        {place.categories.map((part) => {
          const category = projectionCategory(ledger, part.categoryId);
          const share = sharePercent(part.totalMinor, place.totalMinor);
          return (
            <div key={part.categoryId ?? 'none'} className="bought-row">
              <Bubble icon={category?.icon} color={category?.color ?? null} size={24} glyph={14} />
              <span className="bought-name">{category?.name ?? 'Other'}</span>
              <span className="bought-track" aria-hidden="true">
                <span className="grow-x" style={{ width: `${share}%`, ['--bar' as string]: category?.color ? legacyColor(category.color) : undefined }} />
              </span>
              <span className="num bought-amount">{formatMoney(part.totalMinor, currency)}</span>
              <span className="num meta bought-share">{share}%</span>
            </div>
          );
        })}
      </section>
      <section className="pane-section pane-pays" aria-label="Payments">
        <span className="caps">Payments, newest first</span>
        <ul>
          {place.transactions.map((transaction) => {
            const category = projectionCategory(ledger, transaction.categoryId);
            return (
              <li key={transaction.id}>
                <Link href={`/activity/${transaction.id}`} className="pay-row">
                  <Bubble icon={category?.icon} color={category?.color ?? null} size={26} glyph={15} />
                  <span className="pay-name">{merchantName(transaction.merchant, ledger.aliases) ?? transaction.description ?? category?.name ?? 'Payment'}</span>
                  <span className="meta pay-meta">
                    {rowDay(transaction.transactionDate, now, calendar)}, {ledger.walletNames[transaction.walletId] ?? 'Wallet'}
                  </span>
                  <span className="num pay-amount">−{formatMoney(transaction.amountMinor, currency)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="pane-foot-row">
        <a href={maps} target="_blank" rel="noreferrer" className="see-all">
          Open in Google Maps
          <Mdi name="open-in-new" size={16} />
        </a>
      </div>
    </div>
  );
}
