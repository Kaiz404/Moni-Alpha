'use client';

import {
  dayLabel,
  editedProposal,
  formatMoney,
  formatSignedMoney,
  merchantHistory,
  retypeEdits,
  reviewStatus,
  similarMatches,
  similarRule,
  timesFiled,
  type FinanceProposal,
  type FinanceTransaction,
  type ReviewEdits,
} from '@repo/core';
import { receiptPhotoUrl } from '@repo/data';
import { decimalToMinor, type MinorAmount, type TransactionType } from '@repo/types';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { captureSource, clockTime } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { captureName } from '@/lib/review-view';
import { createClient } from '@/lib/supabase/client';
import { SourceBubble } from './source-bubble';

type Field = 'type' | 'category' | 'wallet' | 'to';

const TYPES: readonly { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

function sum(rows: readonly FinanceTransaction[]): number {
  return rows.reduce((total, row) => total + row.amountMinor, 0);
}

function alertText(row: FinanceTransaction): string {
  const alert = row.metadata.alert as { text?: unknown } | undefined;
  return typeof alert?.text === 'string' ? alert.text : (row.merchant ?? '');
}

/**
 * W2-Review's capture: the source beside the proposed transaction, each field edited in place, "Don't
 * ask about similar" with its rule preview, and Not mine · Approve. One element for every layout: docked
 * on the desktop, over the list on the one-column rail, and the deck's one card on the phone layout.
 */
export function CapturePane({
  ledger,
  capture,
  position,
  asked,
  edits,
  onEdits,
  similar,
  onSimilar,
  picked,
  onMove,
  onClose,
  onApprove,
  onNotMine,
}: {
  ledger: Ledger;
  capture: FinanceProposal;
  position: string;
  /** The URL names this capture, so the one-column rail lays the pane over the list. */
  asked: boolean;
  edits: ReviewEdits;
  onEdits: (edits: ReviewEdits) => void;
  similar: boolean;
  onSimilar: (on: boolean) => void;
  picked: number;
  onMove: (by: 1 | -1) => void;
  onClose: () => void;
  onApprove: () => void;
  onNotMine: () => void;
}) {
  const { projection, calendar, now, wallets, walletNames, userId } = ledger;
  const [open, setOpen] = useState<Field | null>(null);
  const [editing, setEditing] = useState<'merchant' | 'amount' | null>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    setOpen(null);
    setEditing(null);
  }, [capture.id]);

  const next = editedProposal(capture, edits);
  const type = next.type ?? 'expense';
  const category = next.categoryId ? projection.categoriesById[next.categoryId] : undefined;
  const wallet = next.walletId ? projection.walletsById[next.walletId] : undefined;
  const to = next.transferToWalletId ? projection.walletsById[next.transferToWalletId] : undefined;
  const sameCurrency = wallets.filter((each) => each.currency === capture.currency);
  const categories = Object.values(projection.categoriesById)
    .filter((each) => each.isActive && (each.userId === null || each.userId === userId) && (each.type === null || each.type === type))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const at = capture.transactionDate ?? capture.createdAt;
  const when = `${dayLabel(calendar.dayKey(at), calendar.dayKey(now))} · ${clockTime(at, calendar.zone)}`;
  const pill = reviewStatus({
    hasWallet: Boolean(next.walletId),
    paired: Boolean(capture.pairing),
    maybeDuplicate: false,
    timesFiled: timesFiled(next, ledger.transactions),
  });
  const month = calendar.monthKey(now);
  const canSimilar = capture.sourceType === 'notification';
  const rule = similar ? similarRule(capture, edits) : null;
  const matches = rule ? similarMatches(capture, edits, ledger.transactions, month, calendar) : [];
  const history = merchantHistory(next, ledger.transactions, month, calendar);
  const hintWallet = !next.walletId && capture.walletHint
    ? sameCurrency.find((each) => each.name.toLowerCase().includes(capture.walletHint!.toLowerCase()) || capture.walletHint!.toLowerCase().includes(each.name.toLowerCase()))
    : undefined;
  const photo = capture.sourceType === 'image' ? receiptPhotoUrl(createClient(), capture.sourceImageUri) : null;
  const needsWallet = !next.walletId;
  const filedAs = (row: FinanceTransaction) =>
    `${(row.categoryId && projection.categoriesById[row.categoryId]?.name) || 'No category'} · ${walletNames[row.walletId] ?? 'Wallet'}`;

  const set = (patch: ReviewEdits) => {
    setOpen(null);
    onEdits({ ...edits, ...patch });
  };
  const startEdit = (kind: 'merchant' | 'amount') => {
    setDraft(kind === 'merchant' ? captureName(next) : ((next.amountMinor ?? 0) / 100).toFixed(2));
    setEditing(kind);
  };
  const saveEdit = () => {
    if (editing === 'merchant' && draft.trim()) set({ merchant: draft.trim() });
    if (editing === 'amount') {
      try {
        const minor = decimalToMinor(draft.replaceAll(',', ''));
        if (minor > 0) set({ amountMinor: minor as MinorAmount });
        else return;
      } catch {
        return;
      }
    }
    setEditing(null);
  };
  const editor = (label: string, className: string) => (
    <form
      className={`in-place ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        saveEdit();
      }}
    >
      <input
        aria-label={label}
        autoFocus
        value={draft}
        inputMode={editing === 'amount' ? 'decimal' : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          setEditing(null);
        }}
      />
      <button type="button" className="icon-round press" aria-label="Cancel" onClick={() => setEditing(null)}>
        <Icon name="chevron-left" size={18} />
      </button>
      <button type="submit" className="icon-round icon-round-ink press" aria-label="Save">
        <Glyph name="check" size={18} />
      </button>
    </form>
  );
  const row = (field: Field, label: string, lead: ReactNode, value: string, options: ReactNode, tone?: 'lemon') => (
    <div className="picker-anchor capture-field">
      <button
        type="button"
        className="capture-field-btn press"
        data-tone={tone}
        aria-haspopup="listbox"
        aria-expanded={open === field}
        aria-label={`${label}: ${value}`}
        onClick={() => setOpen(open === field ? null : field)}
      >
        <span className="capture-field-label">{label}</span>
        {lead}
        <span className="capture-field-value">{value}</span>
        <Icon name="chevron-down" size={20} />
      </button>
      {open === field && (
        <ul role="listbox" aria-label={label} className="popover motion-pop capture-pop">
          {options}
        </ul>
      )}
    </div>
  );
  const option = (key: string, text: string, chosen: boolean, pick: () => void, lead?: ReactNode) => (
    <li
      key={key}
      role="option"
      aria-selected={chosen}
      tabIndex={0}
      className="popover-row"
      onClick={pick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          pick();
        }
      }}
    >
      {lead}
      {text}
    </li>
  );
  const walletOptions = (current: string | null, pick: (id: string) => void, skip?: string | null) =>
    sameCurrency
      .filter((each) => each.id !== skip)
      .map((each) => option(each.id, each.name, each.id === current, () => pick(each.id), <Bubble icon={each.icon} color={each.color} size={28} glyph={15} />));

  return (
    <aside className="review-pane" aria-label="Capture" data-open={asked ? '' : undefined} data-capture={capture.id}>
      <div className="capture-top">
        <span className="pane-nav" data-only="sidebar rail rail-one-column">
          <button type="button" className="icon-round icon-round-line press" aria-label="Previous capture (K)" onClick={() => onMove(-1)}>
            <Glyph name="chevron-up" size={20} />
          </button>
          <button type="button" className="icon-round icon-round-line press" aria-label="Next capture (J)" onClick={() => onMove(1)}>
            <Icon name="chevron-down" size={20} />
          </button>
        </span>
        <span className="num meta capture-position">{position}</span>
        <button type="button" className="icon-round icon-round-line press" aria-label="Close (Esc)" data-only="rail-one-column" onClick={onClose}>
          <Glyph name="close" size={20} />
        </button>
      </div>
      <div key={capture.id} className="capture-body rise">
        <section aria-label="Source" className="capture-source">
          <div className="source-head">
            <SourceBubble capture={capture} size={40} />
            <span className="inbox-text">
              <b>{captureSource(capture)}</b>
              <span>{when}</span>
            </span>
            {pill && (
              <span className="tone-pill" data-tone={pill.tone}>
                {pill.label}
              </span>
            )}
          </div>
          {capture.sourceType === 'notification' && (
            <div className="source-alert">
              <span className="source-alert-app">
                <span className="source-alert-bell">
                  <Glyph name="bell-outline" size={13} />
                </span>
                <b>{capture.notificationTitle ?? 'Bank'}</b> · {clockTime(capture.notificationReceivedAt ?? at, calendar.zone)}
              </span>
              <blockquote>“{capture.notificationBody ?? capture.sourceText ?? ''}”</blockquote>
            </div>
          )}
          {capture.sourceType === 'text' && (
            <div className="source-chat">
              <blockquote>{capture.sourceText ?? captureName(capture)}</blockquote>
              <span className="meta">You, in Moni chat · {clockTime(at, calendar.zone)}</span>
            </div>
          )}
          {capture.sourceType === 'image' &&
            (photo ? (
              <a className="source-photo" href={photo} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- a user's own photo from storage, any size */}
                <img src={photo} alt={`Receipt from ${captureName(capture)}`} />
              </a>
            ) : (
              <div className="dashed-tile source-photo-missing">
                <Glyph name="image-off-outline" size={22} />
                <span>The photo is still on the phone that took it.</span>
              </div>
            ))}
          {capture.aiReasoning && capture.sourceType !== 'notification' && <p className="source-reason">{capture.aiReasoning}</p>}
        </section>

        <section aria-label="Proposed transaction" className="capture-proposal">
          <div className="capture-titles">
            {editing === 'merchant' ? (
              editor('Merchant name', 'capture-merchant-edit')
            ) : (
              <span className="capture-merchant">
                <span>{captureName(next)}</span>
                <button type="button" className="pen press" aria-label="Edit merchant name" onClick={() => startEdit('merchant')}>
                  <Glyph name="pencil-outline" size={16} />
                </button>
              </span>
            )}
            {editing === 'amount' ? (
              editor('Amount', 'capture-amount-edit')
            ) : (
              <span className="capture-amount">
                <span className="num hero-amount" data-testid="capture-amount">
                  {formatSignedMoney(type, next.amountMinor ?? 0, capture.currency)}
                </span>
                <button type="button" className="pen press" aria-label="Edit amount" onClick={() => startEdit('amount')}>
                  <Glyph name="pencil-outline" size={16} />
                </button>
              </span>
            )}
          </div>
          <div className="capture-fields">
            {row(
              'type',
              'Type',
              null,
              TYPES.find((each) => each.value === type)!.label,
              TYPES.map((each) => option(each.value, each.label, each.value === type, () => set(retypeEdits(capture, each.value)))),
            )}
            {type !== 'transfer' &&
              row(
                'category',
                'Category',
                category ? <Bubble icon={category.icon} color={category.color} size={28} glyph={15} /> : null,
                category?.name ?? 'Pick a category',
                categories.map((each) =>
                  option(each.id, each.name, each.id === next.categoryId, () => set({ categoryId: each.id }), <Bubble icon={each.icon} color={each.color} size={28} glyph={15} />),
                ),
              )}
            {row(
              'wallet',
              type === 'transfer' ? 'From' : 'Wallet',
              wallet ? <Bubble icon={wallet.icon} color={wallet.color} size={28} glyph={15} /> : <Glyph name="wallet-outline" size={18} />,
              wallet?.name ?? 'Pick a wallet',
              walletOptions(next.walletId, (id) => set({ walletId: id })),
              needsWallet ? 'lemon' : undefined,
            )}
            {type === 'transfer' &&
              row(
                'to',
                'To',
                to ? <Bubble icon={to.icon} color={to.color} size={28} glyph={15} /> : null,
                to?.name ?? 'Pick a wallet',
                walletOptions(next.transferToWalletId, (id) => set({ transferToWalletId: id }), next.walletId),
                to ? undefined : 'lemon',
              )}
          </div>
          {needsWallet && capture.walletHint && (
            <div className="capture-hint">
              <span>{capture.walletHint}</span>
              {hintWallet && (
                <button type="button" className="btn btn-ink press" onClick={() => set({ walletId: hintWallet.id })}>
                  Use {hintWallet.name}
                </button>
              )}
            </div>
          )}
          {canSimilar && (
            <label className="similar-check">
              <button type="button" role="checkbox" className="cbx" aria-checked={similar} onClick={() => onSimilar(!similar)}>
                {similar && <Glyph name="check-bold" size={15} />}
              </button>
              <span>Don&apos;t ask about similar</span>
            </label>
          )}
          {rule ? (
            <div className="rule-preview rise" aria-label="Rule preview">
              <p className="rule-line">
                {capture.notificationTitle ?? 'Bank'} alerts from {captureName(next)} <Glyph name="arrow-right" size={15} /> {category?.name ?? 'No category'} ·{' '}
                {wallet?.name ?? 'Wallet'}
              </p>
              <div className="rule-head">
                <span className="caps">Would have matched</span>
                <span className="num rule-meta">
                  {matches.length
                    ? `${matches.length} ${matches.length === 1 ? 'alert' : 'alerts'} this month · ${formatMoney(sum(matches), capture.currency)}`
                    : 'None this month'}
                </span>
              </div>
              {matches.length ? (
                <ul className="rule-matches">
                  {matches.map((match) => (
                    <li key={match.id}>
                      <span className="rule-tick">
                        <Glyph name="check-bold" size={13} />
                      </span>
                      <span className="inbox-text">
                        <span className="rule-quote">“{alertText(match)}”</span>
                        <span>
                          {dayLabel(calendar.dayKey(match.transactionDate), calendar.dayKey(now))} · {clockTime(match.transactionDate, calendar.zone)} · filed {filedAs(match)}
                        </span>
                      </span>
                      <span className="num rule-amount">{formatSignedMoney('expense', match.amountMinor, match.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rule-none">No other {captureName(next)} alerts this month.</p>
              )}
              <span className="caps rule-next-cap">Next time</span>
              <div className="rule-next">
                <Bubble icon={category?.icon} color={category?.color} size={32} glyph={17} />
                <span className="inbox-text">
                  <b>
                    {captureName(next)} <span className="auto-chip">Auto</span>
                  </b>
                  <span>
                    {category?.name ?? 'No category'} · {wallet?.name ?? 'Wallet'}
                  </span>
                </span>
                <span className="rule-auto">Added automatically</span>
              </div>
            </div>
          ) : (
            history.length > 0 && (
              <div className="capture-history rise">
                <div className="rule-head">
                  <span className="caps">{captureName(next).toUpperCase()} this month</span>
                  <span className="num rule-meta">
                    {history.length} {history.length === 1 ? 'time' : 'times'} · {formatMoney(sum(history), capture.currency)}
                  </span>
                </div>
                {history.slice(0, 4).map((each) => {
                  const filed = each.categoryId ? projection.categoriesById[each.categoryId] : undefined;
                  return (
                    <div key={each.id} className="history-row">
                      <Bubble icon={filed?.icon} color={filed?.color} size={30} glyph={16} />
                      <span className="inbox-text">
                        <b>{dayLabel(calendar.dayKey(each.transactionDate), calendar.dayKey(now))}</b>
                        <span>{filedAs(each)}</span>
                      </span>
                      <span className="num">{formatSignedMoney('expense', each.amountMinor, each.currency)}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </section>
      </div>
      <div className="capture-actions">
        <button type="button" className="btn btn-sand press" onClick={onNotMine}>
          <Glyph name="close" size={20} />
          Not mine
          <span className="kbd" data-only="sidebar rail rail-one-column">
            X
          </span>
        </button>
        <span className="capture-note">{rule && !picked ? 'Saves the rule too' : ''}</span>
        <button type="button" className="btn btn-mint approve-btn press" disabled={needsWallet && !picked} onClick={onApprove}>
          <Glyph name="check" size={22} />
          {picked ? `Approve ${picked}` : needsWallet ? 'Pick a wallet' : 'Approve'}
          <span className="kbd" data-only="sidebar rail rail-one-column">
            A
          </span>
        </button>
      </div>
    </aside>
  );
}
