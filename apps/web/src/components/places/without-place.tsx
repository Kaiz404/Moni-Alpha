'use client';

import { formatMoney, merchantName, planAddPlace, type FinanceTransaction, type Place } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import Link from 'next/link';
import { useState } from 'react';
import { Bubble } from '@/components/ledger/glyph';
import { commit, planContext } from '@/lib/ledger/commit';
import { rowDay } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { Mdi } from './mdi';
import { projectionCategory } from './place-map';

type WithoutProps = {
  ledger: Ledger;
  loose: FinanceTransaction[];
  /** Every place the user has, most visited first, for Choose a place. */
  everywhere: Place[];
  picked: string[];
  onPicked: (ids: string[]) => void;
  choosing: boolean;
  onChoosing: (open: boolean) => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Without a place: the range's expenses with no location; tick some and Add a place pins them. */
export function WithoutPlace({ ledger, loose, everywhere, picked, onPicked, choosing, onChoosing }: WithoutProps) {
  const { currency, now, calendar } = ledger;
  const ticked = picked.filter((id) => loose.some((transaction) => transaction.id === id));
  const total = loose.reduce((sum, transaction) => sum + transaction.amountMinor, 0) as MinorAmount;
  const allState = ticked.length === 0 ? 'false' : ticked.length === loose.length ? 'true' : 'mixed';
  const toggle = (id: string) => onPicked(ticked.includes(id) ? ticked.filter((each) => each !== id) : [...ticked, id]);

  return (
    <section id="without" aria-label="Without a place" className="card without-card" data-only="sidebar rail rail-one-column">
      <div className="card-head">
        <h2 className="card-title">Without a place</h2>
        {loose.length > 0 && <span className="num without-total">{formatMoney(total, currency)}</span>}
      </div>
      <p className="without-line">Bills and online buys never need one.</p>
      {loose.length > 0 ? (
        <>
          <div className="without-head">
            <button
              type="button"
              role="checkbox"
              className="tick"
              aria-checked={allState}
              aria-label="Select all"
              onClick={() => onPicked(ticked.length === loose.length ? [] : loose.map((transaction) => transaction.id))}
            >
              <Mdi name="check-bold" size={15} />
            </button>
            <span className="caps">{ticked.length ? `${ticked.length} of ${loose.length} selected` : plural(loose.length, 'expense')}</span>
          </div>
          <ul className="without-rows">
            {loose.map((transaction) => {
              const category = projectionCategory(ledger, transaction.categoryId);
              const on = ticked.includes(transaction.id);
              const name = merchantName(transaction.merchant, ledger.aliases) ?? transaction.description ?? category?.name ?? 'Expense';
              return (
                <li key={transaction.id} className="without-row" aria-selected={on} data-transaction={transaction.id}>
                  <button type="button" role="checkbox" className="tick" aria-checked={on} aria-label={name} onClick={() => toggle(transaction.id)}>
                    <Mdi name="check-bold" size={15} />
                  </button>
                  <Bubble icon={category?.icon} color={category?.color ?? null} size={32} glyph={17} />
                  <span className="row-text">
                    <span className="row-title">{name}</span>
                    <span className="row-meta">
                      {rowDay(transaction.transactionDate, now, calendar)} · {ledger.walletNames[transaction.walletId] ?? 'Wallet'}
                    </span>
                  </span>
                  <span className="num without-amount">−{formatMoney(transaction.amountMinor, currency)}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="meta without-empty">Every expense in this range has a place, or never needs one.</p>
      )}
      <span className="grow-space" />
      <div className="without-note">
        <Mdi name="shield-lock-outline" size={20} />
        <p>
          Moni reads your location only when you add something or a payment arrives. Turn it off per wallet in{' '}
          <Link href="/settings" className="link">
            Location from notifications
          </Link>
          .
        </p>
      </div>
      {choosing && ticked.length > 0 && (
        <ChoosePlace
          everywhere={everywhere}
          count={ticked.length}
          onCancel={() => onChoosing(false)}
          onConfirm={(place) => {
            const done = commit(
              planAddPlace(ticked, place, ledger.projection, planContext(ledger.userId)),
              `${plural(ticked.length, 'expense')} now at ${place.name}`,
            );
            onChoosing(false);
            if (done) onPicked([]);
          }}
        />
      )}
      {ticked.length > 0 && (
        <div className="without-bulk">
          <div role="toolbar" aria-label="Selected expenses" className="places-bulk motion-rise">
            <button type="button" className="places-bulk-close press" aria-label="Clear selection" onClick={() => onPicked([])}>
              <Mdi name="close" size={20} />
            </button>
            <span className="num places-bulk-count">{ticked.length} selected</span>
            <span className="places-bulk-rule" aria-hidden="true" />
            <button type="button" className="places-bulk-btn press" aria-expanded={choosing} onClick={() => onChoosing(!choosing)}>
              <Mdi name="map-marker-plus-outline" size={20} />
              Add a place
              <span className="kbd kbd-on-ink">P</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ChoosePlace({ everywhere, count, onCancel, onConfirm }: { everywhere: Place[]; count: number; onCancel: () => void; onConfirm: (place: Place) => void }) {
  const [search, setSearch] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const words = search.trim().toLowerCase();
  const choices = [...everywhere]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .filter((place) => !words || `${place.name} ${place.area ?? ''}`.toLowerCase().includes(words));
  const chosen = everywhere.find((place) => place.id === choice) ?? null;
  return (
    <div role="dialog" aria-label="Choose a place" className="choose-place motion-pop">
      <div className="choose-head">
        <h3>Choose a place</h3>
        <span className="meta">{count} selected</span>
      </div>
      <label className="choose-search">
        <Mdi name="magnify" size={18} />
        <span className="sr-only">Search places</span>
        <input autoFocus placeholder="Search your places" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="caps choose-group">Your places</div>
      <div className="choose-list" role="listbox" aria-label="Your places">
        {choices.map((place) => (
          <button key={place.id} type="button" role="option" aria-selected={choice === place.id} className="popover-row choose-row" onClick={() => setChoice(place.id)}>
            <Mdi name="map-marker-outline" size={20} />
            <span className="choose-name">{place.name}</span>
            <span className="meta">{plural(place.count, 'visit')}</span>
          </button>
        ))}
        {choices.length === 0 && <p className="meta choose-none">No place matches.</p>}
      </div>
      <div className="choose-foot">
        <button type="button" className="btn btn-sand press" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-ink press" disabled={!chosen} onClick={() => chosen && onConfirm(chosen)}>
          Confirm
        </button>
      </div>
    </div>
  );
}
