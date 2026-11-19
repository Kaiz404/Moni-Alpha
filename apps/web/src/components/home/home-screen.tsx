'use client';

import { formatMoney, monthName } from '@repo/core';
import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { AskMoniMark } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Glyph } from '@/components/ledger/glyph';
import { Page } from '@/components/shell/page';
import { useShellApi } from '@/components/shell/shell-context';
import {
  DEFAULT_HOME_LAYOUT,
  HOME_CARD_LABELS,
  parseHomeLayout,
  swapCards,
  toggleCard,
  type HomeCard,
  type HomeLayout,
} from '@/lib/home-layout';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { useScreenKeys } from '@/lib/screen-keys';
import type { ChecklistItem } from '@/lib/setup';
import { RecentCard } from './recent-card';
import { ReviewCard } from './review-card';
import { useSetupChecklist } from './setup-card';
import { NextDaysCard, PlacesCard, WalletsCard } from './side-cards';
import { SpentCard, type SpentMode } from './spent-card';
import './home.css';

const LAYOUT_KEY = 'moni-home-layout';

function readLayout(): HomeLayout {
  try {
    return parseHomeLayout(window.localStorage.getItem(LAYOUT_KEY));
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

function storeLayout(layout: HomeLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Private windows refuse storage; the layout then lasts until the tab closes.
  }
}

/** A swap animates as a view transition (W2-Home: animate every swap); without one it just happens. */
function animated(change: () => void) {
  const start = (document as Document & { startViewTransition?: (update: () => void) => unknown }).startViewTransition;
  if (!start || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return change();
  start.call(document, () => flushSync(change));
}

function greeting(now: Date, zone: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
}

/** "Wednesday, 14 Oct", as the Home header draws it. */
function headerDate(now: Date, zone: string): string {
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...options }).format(now);
  return `${part({ weekday: 'long' })}, ${part({ day: 'numeric' })} ${part({ month: 'short' })}`;
}

function cardFor(card: HomeCard, ledger: Ledger, setup: ChecklistItem[] | null, checkInDismissed: boolean, dismissCheckIn: () => void): ReactNode {
  switch (card) {
    case 'review':
      return <ReviewCard ledger={ledger} setup={setup} />;
    case 'recent':
      return <RecentCard ledger={ledger} />;
    case 'next':
      return <NextDaysCard ledger={ledger} />;
    case 'map':
      return <PlacesCard ledger={ledger} />;
    case 'wallets':
      return <WalletsCard ledger={ledger} dismissed={checkInDismissed} onDismiss={dismissCheckIn} />;
  }
}

/**
 * W2-Home: the spent chart and the review card, then Recent, Next 14 days, Where you spend and Wallets in
 * fixed slots that Customise swaps and hides. One tree for every layout: CSS places the slots, and the
 * phone layout reads them top to bottom as the phone's Home does.
 */
export function HomeScreen() {
  const ledger = useLedger();
  const { user, run } = useShellApi();
  const [mode, setMode] = useState<SpentMode>('pace');
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<HomeLayout>(DEFAULT_HOME_LAYOUT);
  const [dragging, setDragging] = useState<HomeCard | null>(null);
  const [checkInDismissed, setCheckInDismissed] = useState(false);
  useEffect(() => setLayout(readLayout()), []);

  const change = (update: (current: HomeLayout) => HomeLayout) =>
    animated(() =>
      setLayout((current) => {
        const next = update(current);
        storeLayout(next);
        return next;
      }),
    );

  useScreenKeys((key) => {
    if (key === 'Escape' && editing) {
      setEditing(false);
      return true;
    }
    if (editing) return false;
    if (key === 'p') setMode('pace');
    else if (key === 'd') setMode('daily');
    else return false;
    return true;
  });

  const zone = ledger.calendar.zone;
  // Until the first transaction Home welcomes the new account and its chart says what will draw there.
  const firstRun = ledger.loaded && ledger.transactions.length === 0;
  const setup = useSetupChecklist(ledger);
  const title = editing
    ? 'Customise Home'
    : !ledger.mounted
      ? user.name
      : firstRun
        ? `Welcome to Moni, ${user.name}`
        : `${greeting(ledger.now, zone)}, ${user.name}`;
  const date = ledger.mounted ? headerDate(ledger.now, zone) : '';
  const netWorth = ledger.wallets
    .filter((wallet) => wallet.currency === ledger.currency)
    .reduce((sum, wallet) => sum + Number(ledger.balances[wallet.id] ?? 0), 0);

  const dropOn = (target: HomeCard) => (event: DragEvent) => {
    event.preventDefault();
    const from = event.dataTransfer.getData('text/plain') as HomeCard;
    setDragging(null);
    if (from && from !== target) change((current) => swapCards(current, from, target));
  };

  return (
    <Page
      title={title}
      sub={editing ? 'Drag a card onto another to swap them. Cards keep their size.' : date}
      phone="home"
      phoneSub={date}
      commandText={editing ? null : undefined}
      actions={
        editing ? (
          <>
            <button type="button" className="btn btn-out press" onClick={() => change(() => DEFAULT_HOME_LAYOUT)}>
              <Glyph name="restore" size={20} />
              Reset
            </button>
            <button type="button" className="btn btn-ink press" onClick={() => setEditing(false)}>
              Done
              <span className="kbd kbd-on-ink">Esc</span>
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-out customise-btn press" onClick={() => setEditing(true)} aria-label="Customise Home">
            <Glyph name="view-dashboard-edit-outline" size={20} />
            <span className="customise-text">Customise</span>
          </button>
        )
      }
    >
      <div className="home" data-editing={editing || undefined} data-loaded={ledger.loaded || undefined}>
        <a href="#" className="net-worth-block" data-only="phone" onClick={(event) => event.preventDefault()}>
          <span className="caps net-worth-caps">
            Net worth <Icon name="chevron-right" size={16} />
          </span>
          <span className="net-worth num" data-net-worth={netWorth}>
            {formatMoney(netWorth, ledger.currency)}
          </span>
        </a>
        <div className="home-top">
          <div className="home-slot slot-spent" data-locked={editing || undefined}>
            <SpentCard month={ledger.month} mode={mode} onMode={setMode} firstRun={firstRun} />
            {editing && (
              <div className="slot-edit slot-edit-locked">
                <span className="slot-lock">
                  <Icon name="lock-outline" size={17} />
                  Spent in {monthName(ledger.month.month)} stays first
                </span>
              </div>
            )}
          </div>
          <button type="button" className="ask-box press" data-only="phone" onClick={() => run({ kind: 'ask' })}>
            <AskMoniMark size={26} id="home-ask" />
            Ask or add a transaction
          </button>
          {renderSlot(0)}
        </div>
        <div className="home-grid">
          {[1, 2, 3, 4].map(renderSlot)}
        </div>
      </div>
    </Page>
  );

  function renderSlot(index: number) {
    const card = layout.slots[index]!;
    const hidden = layout.hidden.includes(card);
    const label = HOME_CARD_LABELS[card];
    return (
      <div
        key={card}
        className={`home-slot slot-${index}`}
        data-slot-card={card}
        data-hidden={hidden || undefined}
        style={{ viewTransitionName: `home-${card}` }}
        onDragOver={editing ? (event) => event.preventDefault() : undefined}
        onDrop={editing ? dropOn(card) : undefined}
      >
        {(!hidden || editing) && cardFor(card, ledger, setup, checkInDismissed, () => setCheckInDismissed(true))}
        {editing && (
          <div
            className="slot-edit"
            data-hidden={hidden || undefined}
            data-dragging={dragging === card || undefined}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', card);
              event.dataTransfer.effectAllowed = 'move';
              setDragging(card);
            }}
            onDragEnd={() => setDragging(null)}
          >
            <span className="slot-cap">
              <button
                type="button"
                className="slot-grip"
                aria-label={`Move ${label}: arrow keys swap it with the next card`}
                onKeyDown={(event) => {
                  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
                  const other = layout.slots[(index + step + layout.slots.length) % layout.slots.length];
                  if (!step || !other) return;
                  event.preventDefault();
                  change((current) => swapCards(current, card, other));
                }}
              >
                <Glyph name="drag" size={20} />
              </button>
              <span className="slot-name">{label}</span>
              <button type="button" role="switch" className="slot-switch" aria-checked={!hidden} aria-label={`Show ${label} on Home`} onClick={() => change((current) => toggleCard(current, card))}>
                <span />
              </button>
              <span className="slot-state">{hidden ? 'Hidden' : 'Shown'}</span>
            </span>
          </div>
        )}
      </div>
    );
  }
}
