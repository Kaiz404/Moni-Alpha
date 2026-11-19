'use client';

import { formatMoney, merchantName, placeByDay, placesTotal, sharePercent, type Place } from '@repo/core';
import { legacyColor, type MinorAmount } from '@repo/types';
import Link from 'next/link';
import { Bubble } from '@/components/ledger/glyph';
import { rowDay } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { hotSpot, placeMeta, placeSub, type PlacesQuery } from '@/lib/places-view';
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

/** The places list beside the map, or the picked place's pane in its place (W2-Places). */
export function PlaceSide(props: SideProps) {
  return (
    <aside aria-label="Places" className="card places-side">
      {props.data.selected ? <PlacePane {...props} place={props.data.selected} /> : <PlacesList {...props} />}
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
        <span className="key-hint" data-only="sidebar rail rail-one-column">
          <span className="kbd">J</span>
          <span className="kbd">K</span>
        </span>
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

function PlacePane({ ledger, data, onPick, place, categoryWords }: SideProps & { place: Place }) {
  const { places, days, range, query } = data;
  const { currency, calendar, now } = ledger;
  const index = places.indexOf(place);
  const byDay = placeByDay(place, calendar);
  const dayMax = Math.max(1, ...days.map((day) => byDay[day.day]?.totalMinor ?? 0));
  const many = days.length > 14;
  const lead = projectionCategory(ledger, place.categories[0]?.categoryId ?? null);
  const each = Math.round(place.totalMinor / place.count) as MinorAmount;
  const top = query.sort === 'spent' && index === 0 && places.length > 1;
  const maps = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}${place.id.includes(',') ? '' : `&query_place_id=${encodeURIComponent(place.id)}`}`;
  return (
    <div className="place-pane" key={place.id}>
      <div className="pane-nav">
        <button type="button" className="pane-back press" onClick={() => onPick(null)}>
          <Mdi name="chevron-left" size={20} />
          All places
          <span className="kbd" data-only="sidebar rail rail-one-column">
            Esc
          </span>
        </button>
        <span className="meta num pane-index">
          {index + 1} of {places.length}
        </span>
        <button type="button" className="icon-round press" aria-label="Previous place (K)" disabled={index <= 0} onClick={() => onPick(places[index - 1]!.id)}>
          <Mdi name="chevron-up" size={20} />
        </button>
        <button type="button" className="icon-round press" aria-label="Next place (J)" disabled={index >= places.length - 1} onClick={() => onPick(places[index + 1]!.id)}>
          <Mdi name="chevron-down" size={20} />
        </button>
      </div>
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
        <span className="caps">By day · {range.label}</span>
        <div className="visit-bars" style={{ gap: many ? 3 : 6 }}>
          {days.map((day, at) => {
            const value = byDay[day.day];
            const height = value ? Math.max(6, Math.round((46 * value.totalMinor) / dayMax)) : 0;
            const category = projectionCategory(ledger, value?.categoryId ?? null);
            const label = at === days.length - 1 ? 'Today' : `${day.date}${day.month ? ` ${day.month}` : ''}`;
            const tick = at === 0 || at === days.length - 1 || day.date === 1 || (!many && at % 2 === 0);
            return (
              <span key={day.day} className="visit-col" title={value ? `${day.date} ${day.month ?? ''} · ${formatMoney(value.totalMinor, currency)}`.replace('  ', ' ') : undefined}>
                <span className="visit-bar grow" style={{ height, ['--bar' as string]: category?.color ? legacyColor(category.color) : undefined }}/>
                {value && value.totalMinor === dayMax && <span className="num visit-top">{formatMoney(value.totalMinor, currency)}</span>}
                <span className="visit-tick" data-edge={at === 0 ? 'start' : at === days.length - 1 ? 'end' : undefined}>
                  {tick ? label : ''}
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
        <span className="caps">Payments · newest first</span>
        <ul>
          {place.transactions.map((transaction) => {
            const category = projectionCategory(ledger, transaction.categoryId);
            return (
              <li key={transaction.id}>
                <Link href={`/activity/${transaction.id}`} className="pay-row">
                  <Bubble icon={category?.icon} color={category?.color ?? null} size={26} glyph={15} />
                  <span className="pay-name">{merchantName(transaction.merchant, ledger.aliases) ?? transaction.description ?? category?.name ?? 'Payment'}</span>
                  <span className="meta pay-meta">
                    {rowDay(transaction.transactionDate, now, calendar)} · {ledger.walletNames[transaction.walletId] ?? 'Wallet'}
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
