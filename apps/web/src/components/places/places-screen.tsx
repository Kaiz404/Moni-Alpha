'use client';

import { formatMoney, placeRanges, type PlaceRangeKey } from '@repo/core';
import { useState, type ReactNode } from 'react';
import { Select } from '@/components/controls/select';
import { Bubble } from '@/components/ledger/glyph';
import { SlideOver } from '@/components/ledger/slide-over';
import { useQueryParams, useStepBack } from '@/components/ledger/use-query-param';
import { Page } from '@/components/shell/page';
import { useLayout } from '@/components/shell/use-layout';
import { useScreenKeys } from '@/lib/screen-keys';
import { FIT, type MapView } from '@/lib/places-view';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { DayGrid } from './day-grid';
import { Mdi } from './mdi';
import { PlaceMap } from './place-map';
import { PlacePane, PlaceSide } from './place-side';
import { usePlaces, type FilterOption } from './use-places';
import { WithoutPlace } from './without-place';
import '@/components/ledger/ledger.css';
import './places.css';

function Frame({ children }: { children: ReactNode }) {
  return (
    <Page title="Where you spend" crumb={{ label: 'Home', href: '/home' }} phone="pushed" back="/home" commandText="Search places or ask Moni">
      {children}
    </Page>
  );
}

/** Where you spend (W2-Places), pushed from Home's card: the map, the places list or a place, Day by day, Without a place. */
export function PlacesScreen() {
  const ledger = useLedger();
  if (!ledger.loaded) {
    return (
      <Frame>
        <div className="places" aria-busy="true">
          <div className="places-stage skeleton" />
          <div className="card places-side skeleton" />
        </div>
      </Frame>
    );
  }
  return (
    <Frame>
      <PlacesLoaded ledger={ledger} />
    </Frame>
  );
}

const ALL = 'all';

function FilterChip({ label, options, value, onPick, currency }: {
  label: string;
  options: FilterOption[];
  value: string | null;
  onPick: (id: string | null) => void;
  currency: string;
}) {
  const current = options.find((option) => option.id === value) ?? options[0]!;
  return (
    <Select
      label={label}
      className="map-chip press"
      listClassName="map-popover"
      text={value === null ? 'All' : current.label}
      value={value ?? ALL}
      options={options.map((option) => ({
        value: option.id ?? ALL,
        label: option.label,
        lead: <Bubble icon={option.icon} color={option.color} size={28} glyph={16} />,
        side: <span className="num meta">{formatMoney(option.amountMinor, currency)}</span>,
      }))}
      onChange={(id) => onPick(id === ALL ? null : id)}
    >
      <Bubble icon={current.icon} color={current.color} size={26} glyph={15} />
      <span className="map-chip-label">{label}</span>
      {value === null ? 'All' : current.label}
      <Mdi name="chevron-down" size={18} />
    </Select>
  );
}

function PlacesLoaded({ ledger }: { ledger: Ledger }) {
  const layout = useLayout();
  const [params, setParams] = useQueryParams();
  const data = usePlaces(ledger, params);
  const { query, places, selected, range } = data;
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [view, setView] = useState<MapView>(FIT);
  const [picked, setPicked] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  const ranges = placeRanges(ledger.now, ledger.calendar);
  const categoryName = query.categoryId ? (ledger.projection.categoriesById[query.categoryId]?.name ?? null) : null;
  const categoryWords = categoryName ? ` on ${categoryName}` : '';
  const emptyLine = `Nothing${categoryWords} with a place ${range.words}`;

  const pick = (id: string | null) => setParams({ place: id }, id && !selected ? 'push' : 'replace');
  const close = useStepBack(Boolean(selected), () => pick(null));
  const selectedIndex = selected ? places.indexOf(selected) : -1;
  const step = (by: number) => {
    if (!places.length) return;
    const at = selected ? places.indexOf(selected) : -1;
    const next = at < 0 ? (by > 0 ? 0 : places.length - 1) : Math.max(0, Math.min(places.length - 1, at + by));
    pick(places[next]!.id);
  };

  useScreenKeys((key) => {
    if (key === 'Escape') {
      if (choosing) setChoosing(false);
      else if (selected) close();
      else if (picked.length) setPicked([]);
      else return false;
      return true;
    }
    if (key === 'j') step(1);
    else if (key === 'k') step(-1);
    else if (key === 'h') setParams({ view: query.view === 'heat' ? null : 'heat' });
    else if (key === 'f') setView(FIT);
    else if (key === 'p' && picked.length && layout !== 'phone') setChoosing(true);
    else return false;
    return true;
  });

  return (
    <div className="places" data-screen="places">
      <div className="places-stage">
        <PlaceMap
          ledger={ledger}
          layout={layout}
          everywhere={data.everywhere}
          places={places}
          selectedId={selected?.id ?? null}
          hoverId={hoverId}
          heat={query.view === 'heat'}
          view={view}
          onView={setView}
          onPick={pick}
          onHover={setHoverId}
          onHeat={(heat) => setParams({ view: heat ? 'heat' : null })}
          emptyLine={emptyLine}
          locationOff={data.locationOff}
        />
        <div className="map-filters">
          <span className="map-float pseg-wrap">
            <span className="pseg" role="radiogroup" aria-label="Range">
              <span className="pseg-pill" aria-hidden="true" style={{ width: 'calc((100% - 6px) / 3)', transform: `translateX(${ranges.findIndex((each) => each.key === range.key) * 100}%)` }} />
              {ranges.map((each) => (
                <button key={each.key} type="button" role="radio" aria-checked={each.key === range.key} onClick={() => setParams({ range: each.key === '30d' ? null : (each.key as PlaceRangeKey) })}>
                  {each.label}
                </button>
              ))}
            </span>
          </span>
          <span className="map-chips">
            <FilterChip
              label="Category"
              options={data.categoryOptions}
              value={query.categoryId}
              onPick={(id) => setParams({ category: id })}
              currency={ledger.currency}
            />
            <FilterChip
              label="Wallets"
              options={data.walletOptions}
              value={query.walletId}
              onPick={(id) => setParams({ wallet: id })}
              currency={ledger.currency}
            />
          </span>
        </div>
      </div>
      <PlaceSide
        ledger={ledger}
        data={data}
        hoverId={hoverId}
        onPick={pick}
        onHover={setHoverId}
        onSort={(sort) => setParams({ sort: sort === 'spent' ? null : sort })}
        categoryWords={categoryWords}
      />
      <DayGrid
        ledger={ledger}
        places={places}
        days={data.days}
        rangeLabel={range.label}
        emptyLine={`${emptyLine}.`}
        litId={hoverId ?? selected?.id ?? null}
        onPick={pick}
        onHover={setHoverId}
      />
      <WithoutPlace
        ledger={ledger}
        loose={data.loose}
        everywhere={data.everywhere}
        picked={picked}
        onPicked={setPicked}
        choosing={choosing}
        onChoosing={setChoosing}
      />
      <SlideOver
        label="Place"
        name="place"
        back="Where you spend"
        steps={selectedIndex >= 0 ? { noun: 'place', position: `${selectedIndex + 1} of ${places.length}`, onMove: step, first: selectedIndex === 0, last: selectedIndex === places.length - 1 } : undefined}
        open={Boolean(selected)}
        onClose={close}
      >
        {selected && <PlacePane ledger={ledger} data={data} place={selected} categoryWords={categoryWords} onClose={close} />}
      </SlideOver>
    </div>
  );
}
