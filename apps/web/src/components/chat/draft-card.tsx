'use client';

import { dayLabel, draftAfter, formatMoney, type CategoryAfter } from '@repo/core';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import type { ChatMessage } from '@/lib/chat-thread';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { approveDraft, keepDraft } from './ask';

type DraftMessage = Extract<ChatMessage, { kind: 'draft' }>;

const SHOWN = 6;

function After({ line, currency }: { line: CategoryAfter; currency: string }) {
  const over = line.budgetMinor !== null && line.afterMinor > line.budgetMinor;
  const value =
    line.budgetMinor === null
      ? `${formatMoney(line.afterMinor, currency)} this month`
      : `${formatMoney(line.afterMinor, currency)} of ${formatMoney(line.budgetMinor, currency, { whole: true })}${
          over ? `, ${formatMoney(line.afterMinor - line.budgetMinor, currency, { whole: true })} over` : ''
        }`;
  return (
    <span className="draft-after num">
      <span>{line.name} after</span>
      <span data-over={over || undefined}>{value}</span>
    </span>
  );
}

/**
 * W2-Chat's draft for many rows: what moves, from and to, and each category's month after it, with
 * Not mine and Approve (Enter while the card has focus). The same rows light up in Activity behind.
 */
export function DraftCard({ message, ledger }: { message: DraftMessage; ledger: Ledger }) {
  const card = useRef<HTMLDivElement>(null);
  const { draft, state } = message;
  const open = state.phase === 'open';
  useEffect(() => {
    if (open) card.current?.focus({ preventScroll: true });
  }, [open]);

  if (state.phase === 'done')
    return (
      <div className="chat-card draft-settled motion-rise" data-state="done">
        <Glyph name="check-circle" size={20} className="draft-done-icon" />
        <span className="draft-settled-text">
          Changed {draft.rows.length} {draft.rows.length === 1 ? 'row' : 'rows'} to {draft.to.name}
        </span>
        <button type="button" className="link" onClick={state.undo}>
          Undo
        </button>
      </div>
    );
  if (state.phase === 'kept')
    return (
      <div className="chat-card draft-settled motion-rise" data-state="kept">
        <Glyph name="close-circle-outline" size={20} className="draft-kept-icon" />
        <span className="draft-settled-text draft-kept-text">
          {draft.from ? `Kept in ${draft.from.name}.` : 'Kept as they were.'} Nothing changed.
        </span>
      </div>
    );

  const category = (id: string) => ledger.projection.categoriesById[id];
  const from = draft.from ? category(draft.from.id) : undefined;
  const to = category(draft.to.id);
  const month = ledger.calendar.monthKey(ledger.now);
  const spends = [...ledger.month.budgeted, ...ledger.month.unbudgeted];
  const after = draftAfter(draft, month, (id) => {
    const spend = spends.find((each) => each.categoryId === id);
    return { spentMinor: Number(spend?.spentMinor ?? 0), budgetMinor: spend?.budgetMinor == null ? null : Number(spend.budgetMinor) };
  });
  const today = ledger.calendar.dayKey(ledger.now);
  const rest = draft.rows.length - SHOWN;

  return (
    <div
      ref={card}
      tabIndex={0}
      role="group"
      aria-label={`Draft: change ${draft.rows.length} rows to ${draft.to.name}. Enter approves.`}
      className="chat-card draft-card"
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.target !== event.currentTarget) return;
        event.preventDefault();
        approveDraft(message.id, ledger);
      }}
    >
      <div className="draft-top">
        <span className="caps">Draft category change</span>
        <span className="caps num">
          {draft.rows.length} {draft.rows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>
      <div className="draft-move">
        <span className="draft-cat">
          {draft.from ? <Bubble icon={from?.icon} color={from?.color} size={24} glyph={13} /> : null}
          {draft.from?.name ?? 'Several categories'}
        </span>
        <Glyph name="arrow-right" size={18} />
        <span className="draft-cat">
          <Bubble icon={to?.icon} color={to?.color} size={24} glyph={13} />
          {draft.to.name}
        </span>
      </div>
      <ul className="draft-rows">
        {draft.rows.slice(0, SHOWN).map((row) => (
          <li key={row.id} className="draft-row" data-row-id={row.id}>
            <span className="draft-row-name">{row.name}</span>
            <span className="draft-row-day">{dayLabel(row.day, today)}</span>
            <span className="draft-row-amount num">−{formatMoney(row.amountMinor, ledger.currency)}</span>
          </li>
        ))}
        {rest > 0 && (
          <li className="draft-row draft-row-more">
            <span className="draft-row-name">
              {rest} more {rest === 1 ? 'row' : 'rows'}
            </span>
            <span className="draft-row-amount num">
              −{formatMoney(draft.rows.slice(SHOWN).reduce((sum, row) => sum + row.amountMinor, 0), ledger.currency)}
            </span>
          </li>
        )}
      </ul>
      <div className="draft-afters">
        {after.from && <After line={after.from} currency={ledger.currency} />}
        <After line={after.to} currency={ledger.currency} />
      </div>
      <div className="draft-actions">
        <button type="button" className="btn btn-sand press draft-btn" onClick={() => keepDraft(message.id)}>
          Not mine
        </button>
        <button type="button" className="btn btn-ink press draft-btn draft-approve" onClick={() => approveDraft(message.id, ledger)}>
          <Icon name="check" size={18} />
          Approve
          <span className="kbd kbd-on-ink">Enter</span>
        </button>
      </div>
    </div>
  );
}
