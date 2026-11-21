'use client';

import { compactWalletNames, formatMoney, moveWallet, planWalletOrder, reorderSlot, walletGroups, walletTint, type WalletGroup } from '@repo/core';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { Glyph } from '@/components/ledger/glyph';
import { typeIcon } from '@/components/wallets/wallet-form';
import { commit } from '@/lib/ledger/commit';
import type { Ledger } from '@/lib/ledger/use-ledger';

const STEP = 158;
const HOLD_MS = 500;
const EDGE_ZONE = 56;

type Drag = { currency: string; id: string; from: number; pointer: number; x: number; scroll: number; offset: number; order: string[] };
type Press = { id: string; currency: string; pointer: number; x: number; y: number; touch: boolean; timer: number | null };

/**
 * Home's wallet strip (#120, XW-WalletCardStyle-Final on the web): a card per wallet, the main currency first
 * and every other currency behind a divider, then New wallet. Drag a card with the mouse, or hold it 500 ms on
 * touch, to move it within its currency; Alt and an arrow moves the focused card. One order with Wallets.
 */
export function WalletStrip({ ledger }: { ledger: Ledger }) {
  const { wallets, balances, currency, projection } = ledger;
  const groups = walletGroups(wallets, balances, currency);
  const names = compactWalletNames(wallets);
  const scroller = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const dragged = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<string[] | null>(null);
  const key = wallets.map((wallet) => wallet.id).join('|');
  useEffect(() => setPending(null), [key]);

  const save = (order: string[]) => {
    const full = groups.flatMap((group) => group.wallets.map((wallet) => wallet.id));
    if (order.join('|') === full.join('|')) return;
    setPending(order);
    commit(planWalletOrder(order, projection, { now: new Date().toISOString() }), 'Wallet moved');
  };
  const orderWith = (group: WalletGroup, ids: string[]) => groups.flatMap((other) => (other === group ? ids : other.wallets.map((wallet) => wallet.id)));

  const follow = (state: Drag, clientX: number): Drag => {
    const ids = groups.find((group) => group.currency === state.currency)!.wallets.map((wallet) => wallet.id);
    const scroll = scroller.current?.scrollLeft ?? 0;
    const offset = Math.min(Math.max(clientX - state.x + scroll - state.scroll, -state.from * STEP), (ids.length - 1 - state.from) * STEP);
    const order = ids.filter((id) => id !== state.id);
    order.splice(reorderSlot(state.from, offset, STEP, ids.length), 0, state.id);
    return { ...state, pointer: clientX, offset, order };
  };

  useEffect(() => {
    if (!drag) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const box = scroller.current?.getBoundingClientRect();
      const seconds = (now - last) / 1000;
      last = now;
      setDrag((state) => {
        if (!state || !box || !scroller.current) return state;
        const x = state.pointer - box.left;
        const pull = x < EDGE_ZONE ? -(1 - x / EDGE_ZONE) : x > box.width - EDGE_ZONE ? 1 - (box.width - x) / EDGE_ZONE : 0;
        if (pull === 0) return state;
        scroller.current.scrollLeft += Math.max(-1, Math.min(1, pull)) * STEP * seconds;
        return follow(state, state.pointer);
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // One loop per lift; `follow` reads the groups of the render that lifted the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  const lift = (state: Press, element: HTMLElement) => {
    const group = groups.find((item) => item.currency === state.currency)!;
    const from = group.wallets.findIndex((wallet) => wallet.id === state.id);
    element.setPointerCapture(state.pointer);
    dragged.current = true;
    setDrag({ currency: state.currency, id: state.id, from, pointer: state.x, x: state.x, scroll: scroller.current?.scrollLeft ?? 0, offset: 0, order: group.wallets.map((wallet) => wallet.id) });
  };

  const handlers = (group: WalletGroup, id: string) => ({
    onPointerDown: (event: PointerEvent<HTMLAnchorElement>) => {
      if (event.button !== 0) return;
      dragged.current = false;
      const touch = event.pointerType !== 'mouse';
      const element = event.currentTarget;
      const state: Press = { id, currency: group.currency, pointer: event.pointerId, x: event.clientX, y: event.clientY, touch, timer: null };
      if (touch) state.timer = window.setTimeout(() => press.current === state && lift(state, element), HOLD_MS);
      press.current = state;
    },
    onPointerMove: (event: PointerEvent<HTMLAnchorElement>) => {
      if (drag) {
        setDrag((state) => (state ? follow(state, event.clientX) : state));
        return;
      }
      const state = press.current;
      if (!state || state.id !== id) return;
      const moved = Math.hypot(event.clientX - state.x, event.clientY - state.y);
      if (state.touch && moved > 8) {
        if (state.timer) window.clearTimeout(state.timer);
        press.current = null;
      } else if (!state.touch && moved > 4) {
        lift(state, event.currentTarget);
        setDrag((current) => (current ? follow(current, event.clientX) : current));
      }
    },
    onPointerUp: () => {
      if (press.current?.timer) window.clearTimeout(press.current.timer);
      press.current = null;
      if (!drag) return;
      setDrag(null);
      save(orderWith(group, drag.order));
    },
    onPointerCancel: () => {
      if (press.current?.timer) window.clearTimeout(press.current.timer);
      press.current = null;
      setDrag(null);
    },
    onClick: (event: MouseEvent) => {
      if (!dragged.current) return;
      event.preventDefault();
      dragged.current = false;
    },
    onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => {
      const step = event.altKey ? (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) : 0;
      if (!step) return;
      event.preventDefault();
      const index = group.wallets.findIndex((wallet) => wallet.id === id);
      save(moveWallet(groups, id, index + step));
    },
  });

  if (groups.length === 0) return null;
  const pendingOrder = pending ?? groups.flatMap((group) => group.wallets.map((wallet) => wallet.id));

  return (
    <div ref={scroller} className="wallet-strip" role="group" aria-label="Wallets" data-dragging={drag ? '' : undefined}>
      {groups.map((group, i) => {
        const ids = group.wallets.map((wallet) => wallet.id);
        const order = drag?.currency === group.currency ? drag.order : pendingOrder.filter((id) => ids.includes(id));
        return (
          <Fragment key={group.currency}>
            {i > 0 && <span className="wallet-strip-divider" aria-hidden="true" />}
            <div className="wallet-strip-group" style={{ width: ids.length * STEP - 10 }}>
              {group.wallets.map((wallet) => {
                const lifted = drag?.id === wallet.id;
                const x = lifted ? drag.from * STEP + drag.offset : order.indexOf(wallet.id) * STEP;
                const balance = formatMoney(balances[wallet.id] ?? 0, wallet.currency);
                return (
                  <Link
                    key={wallet.id}
                    href={`/home/wallets/${wallet.id}`}
                    className="wallet-card"
                    data-wallet={wallet.id}
                    data-lifted={lifted || undefined}
                    data-dimmed={(drag && !lifted) || undefined}
                    draggable={false}
                    aria-label={`${wallet.name}, ${balance}`}
                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                    title="Drag, or Alt and an arrow, to move"
                    style={{ transform: `translateX(${x}px)`, background: `var(--color-${walletTint(wallet.cardStyleId, wallet.type)})` }}
                    {...handlers(group, wallet.id)}
                  >
                    <svg className="wallet-card-blobs" viewBox="0 0 148 96" aria-hidden="true">
                      <path d="M92,-18 C122,-26 162,-6 158,30 C155,58 128,62 112,50 C96,38 70,40 66,18 C63,2 74,-12 92,-18 Z" className="wallet-card-light" />
                      <path d="M108,70 C126,58 160,64 162,88 C164,112 132,118 112,110 C94,103 92,80 108,70 Z" className="wallet-card-deep" />
                    </svg>
                    <span className="wallet-card-head">
                      <span className="wallet-card-badge">
                        <Glyph name={typeIcon(wallet.type)} size={16} />
                      </span>
                      <span className="wallet-card-name">{names[wallet.id] ?? wallet.name}</span>
                    </span>
                    <span className="wallet-card-balance num">{balance}</span>
                  </Link>
                );
              })}
            </div>
          </Fragment>
        );
      })}
      <Link href="/home/wallets?new=wallet" className="wallet-card-new press">
        <span className="wallet-card-new-plus">
          <Glyph name="plus" size={20} />
        </span>
        New wallet
      </Link>
    </div>
  );
}
