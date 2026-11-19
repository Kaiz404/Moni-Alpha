'use client';

import {
  correctBalance,
  firstDayOf,
  formatMoney,
  groupPlaces,
  nextDays,
  parseBalanceInput,
  planCheckIn,
  summarizeDebts,
  walletToCheckIn,
  type FinanceDebtActivity,
} from '@repo/core';
import { miniMapStyles } from '@repo/design';
import { minorToNumber } from '@repo/types';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { useSize } from '@/components/ledger/chart-parts';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { useMapsUsable } from '@/components/places/map-ground';
import { useTheme } from '@/components/use-theme';
import { MAPS_KEY, staticCover, staticFrame, staticMapUrl } from '@/lib/google-maps';
import { commit, planContext } from '@/lib/ledger/commit';
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

/** Wallets with the check-in answered in place: That's right, Fix it, Not now (W2-Home). */
export function WalletsCard({ ledger, onDismiss, dismissed }: { ledger: Ledger; onDismiss: () => void; dismissed: boolean }) {
  const { wallets, balances, currency, transactions, now, calendar, projection, userId } = ledger;
  const main = wallets.filter((wallet) => wallet.currency === currency);
  const other = wallets.filter((wallet) => wallet.currency !== currency);
  const lastUsed = useMemo(() => {
    const seen: Record<string, string> = {};
    for (const transaction of transactions)
      for (const id of [transaction.walletId, transaction.transferToWalletId]) if (id && !seen[id]) seen[id] = transaction.transactionDate;
    return seen;
  }, [transactions]);
  const ask = dismissed ? null : walletToCheckIn({ wallets, balancesByWallet: balances, lastUsedByWallet: lastUsed, currency, now, calendar });
  const [draft, setFixDraft] = useState<string | null>(null);
  const fixing = draft !== null && ask !== null;
  const netWorth = main.reduce((sum, wallet) => sum + Number(balances[wallet.id] ?? 0), 0);

  const answer = (typed: string | null) => {
    if (!ask) return;
    const value = typed === null ? null : parseBalanceInput(typed);
    if (typed !== null && value === null) return;
    const correction = value === null ? null : correctBalance({ balance: minorToNumber(ask.balanceMinor) }, value);
    setFixDraft(null);
    commit(planCheckIn(ask.wallet.id, correction, projection, planContext(userId)), correction ? `${ask.wallet.name} fixed` : `${ask.wallet.name} checked`);
  };

  return (
    <section aria-label="Wallets" className="card wallets-card" data-card="wallets">
      <div className="section-head" data-only="sidebar rail rail-one-column">
        <h2 className="card-title">Wallets</h2>
        <Link href="/home/wallets" className="see-all press">
          All wallets
          <Icon name="chevron-right" size={18} />
        </Link>
      </div>
      {main.length === 0 && (
        <div className="wallets-empty" data-only="sidebar rail rail-one-column">
          <span className="caps">Net worth</span>
          <span className="net-worth num">{formatMoney(0, currency)}</span>
          <span className="meta">Add a wallet and Moni adds up what you have.</span>
        </div>
      )}
      {ask && (
        <div className="check-in motion-rise" aria-label="Check-in">
          <div className="wallet-row-inner">
            <Bubble icon={ask.wallet.icon} color={ask.wallet.color} size={32} glyph={17} />
            <span className="wallet-name">{ask.wallet.name}</span>
            <span className="num wallet-balance">{formatMoney(ask.balanceMinor, currency)}</span>
          </div>
          <span className="caps check-in-caps">Check-in{ask.daysAgo !== null ? ` · last done ${ask.daysAgo} days ago` : ''}</span>
          <span className="check-in-question num">
            Is {ask.wallet.name} still {formatMoney(ask.balanceMinor, currency)}?
          </span>
          {fixing ? (
            <form
              className="check-in-fix"
              onSubmit={(event) => {
                event.preventDefault();
                answer(draft);
              }}
            >
              <label className="check-in-field">
                <span className="sr-only">{ask.wallet.name} balance now</span>
                <input id="check-in-draft" inputMode="decimal" autoFocus value={draft ?? ''} placeholder={minorToNumber(ask.balanceMinor).toFixed(2)} onChange={(event) => setFixDraft(event.target.value)} />
              </label>
              <button type="button" className="icon-round press" aria-label="Cancel" onClick={() => setFixDraft(null)}>
                <Icon name="close" size={18} />
              </button>
              <button type="submit" className="icon-round icon-round-ink press" aria-label="Save" disabled={parseBalanceInput(draft ?? '') === null}>
                <Icon name="check" size={18} />
              </button>
            </form>
          ) : (
            <div className="check-in-actions">
              <button type="button" className="btn btn-mint check-in-btn press" onClick={() => answer(null)}>
                <Icon name="check" size={18} />
                That&apos;s right
              </button>
              <button type="button" className="btn btn-paper check-in-btn press" onClick={() => setFixDraft('')}>
                Fix it
              </button>
              <button type="button" className="not-now press" onClick={onDismiss}>
                Not now
              </button>
            </div>
          )}
        </div>
      )}
      <ul className="wallet-rows" data-only="sidebar rail rail-one-column">
        {main
          .filter((wallet) => wallet.id !== ask?.wallet.id)
          .map((wallet) => (
            <li key={wallet.id}>
              <Link href={`/home/wallets/${wallet.id}`} className="wallet-row press">
                <Bubble icon={wallet.icon} color={wallet.color} size={32} glyph={17} />
                <span className="wallet-name">{wallet.name}</span>
                <span className="num wallet-balance">{formatMoney(balances[wallet.id] ?? 0, currency)}</span>
              </Link>
            </li>
          ))}
      </ul>
      <span className="grow-space" />
      {other[0] && (
        <Link href="/home/wallets" className="meta wallets-foot" data-only="sidebar rail rail-one-column">
          {other.length === 1 ? `${other[0].name} keeps its own currency` : `${other.length} wallets keep their own currency`}, on All wallets
        </Link>
      )}
      <span hidden data-net-worth={netWorth} />
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
