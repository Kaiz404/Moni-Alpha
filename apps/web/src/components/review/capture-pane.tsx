'use client';

import {
  captureClues,
  dayLabel,
  daysAgo,
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
import { decimalToMinor, type MinorAmount, type TransactionType } from '@repo/types';
import { useEffect, useState, type ReactNode } from 'react';
import { NewCategoryDialog, newCategoryAction } from '@/components/categories/new-category';
import { Select, type SelectAction, type SelectOption } from '@/components/controls/select';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { ReceiptPhotoButton } from '@/components/receipt/receipt-row';
import { categoryChoices, suggestedCategories } from '@/lib/category-pick';
import { captureSource, clockTime } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { useReceiptPhoto } from '@/lib/receipt-photo';
import { captureName } from '@/lib/review-view';
import { Fact } from './fact';
import { SourceBubble } from './source-bubble';


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
 * W2-Review's capture: the source beside the proposed transaction (above it in a narrow drawer), each
 * field edited in place, "Don't ask about similar" with its rule preview, and Not mine and Approve.
 */
export function CapturePane({
  ledger,
  capture,
  position,
  edits,
  onEdits,
  similar,
  onSimilar,
  picked,
  onMove,
  onApprove,
  onNotMine,
}: {
  ledger: Ledger;
  capture: FinanceProposal;
  position: string;
  edits: ReviewEdits;
  onEdits: (edits: ReviewEdits) => void;
  similar: boolean;
  onSimilar: (on: boolean) => void;
  picked: number;
  onMove: (by: 1 | -1) => void;
  onApprove: () => void;
  onNotMine: () => void;
}) {
  const { projection, calendar, now, wallets } = ledger;
  const [editing, setEditing] = useState<'merchant' | 'amount' | null>(null);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const photo = useReceiptPhoto(capture.sourceType === 'image' ? capture.sourceImageUri : null);
  useEffect(() => {
    setEditing(null);
    setCreating(false);
  }, [capture.id]);

  const next = editedProposal(capture, edits);
  const type = next.type ?? 'expense';
  const category = next.categoryId ? projection.categoriesById[next.categoryId] : undefined;
  const wallet = next.walletId ? projection.walletsById[next.walletId] : undefined;
  const to = next.transferToWalletId ? projection.walletsById[next.transferToWalletId] : undefined;
  const sameCurrency = wallets.filter((each) => each.currency === capture.currency);
  const kind = type === 'income' ? 'income' : 'expense';
  const categories = categoryChoices(ledger, kind);
  const suggested = next.categoryId || type === 'transfer' ? [] : suggestedCategories(ledger, captureClues({ ...next, type }));
  const at = capture.transactionDate ?? capture.createdAt;
  const ago = daysAgo(calendar.dayKey(capture.notificationReceivedAt ?? at), calendar.dayKey(now));
  const whenAt = (time: string) => `${dayLabel(calendar.dayKey(time), calendar.dayKey(now))} at ${clockTime(time, calendar.zone)}`;
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
  const needsWallet = !next.walletId;
  const filedAs = (categoryId: string | null, walletId: string | null) => {
    const filed = categoryId ? projection.categoriesById[categoryId] : undefined;
    const into = walletId ? projection.walletsById[walletId] : undefined;
    return (
      <>
        <Fact icon={filed?.icon ?? 'help-circle-outline'} color={filed?.color ?? null}>
          {filed?.name ?? 'No category'}
        </Fact>
        {into && (
          <Fact icon={into.icon} color={into.color}>
            {into.name}
          </Fact>
        )}
      </>
    );
  };

  const set = (patch: ReviewEdits) => {
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
  const row = <T extends string>(
    label: string,
    lead: ReactNode,
    value: string,
    chosen: T | null,
    options: SelectOption<T>[],
    pick: (value: T) => void,
    extra: { tone?: 'lemon'; suggested?: readonly T[]; action?: SelectAction } = {},
  ) => (
    <div className="capture-field" data-tone={extra.tone}>
      <Select
        label={label}
        text={value}
        className="capture-field-btn press"
        listClassName="capture-pop"
        align="end"
        value={chosen}
        options={options}
        suggested={extra.suggested && { values: extra.suggested, allLabel: 'All categories' }}
        action={extra.action}
        onChange={pick}
      >
        <span className="capture-field-label">{label}</span>
        {lead}
        <span className="capture-field-value">{value}</span>
        <Icon name="chevron-down" size={20} />
      </Select>
    </div>
  );
  const walletOptions = (skip?: string | null) =>
    sameCurrency.filter((each) => each.id !== skip).map((each) => ({ value: each.id, label: each.name, lead: <Bubble icon={each.icon} color={each.color} size={28} glyph={15} /> }));

  return (
    <section className="capture-card" aria-label="Capture" data-capture={capture.id}>
      <div className="capture-top">
        <span className="pane-nav" data-only="sidebar rail rail-one-column">
          <button type="button" className="icon-round icon-round-line icon-round-key press" aria-label="Previous capture (K)" onClick={() => onMove(-1)}>
            <Glyph name="chevron-up" size={20} />
            <span className="kbd kbd-inline">K</span>
          </button>
          <button type="button" className="icon-round icon-round-line icon-round-key press" aria-label="Next capture (J)" onClick={() => onMove(1)}>
            <Icon name="chevron-down" size={20} />
            <span className="kbd kbd-inline">J</span>
          </button>
        </span>
        <span className="num meta capture-position">{position}</span>
      </div>
      <div key={capture.id} className="capture-body rise">
        <section aria-label="Source" className="capture-source">
          <div className="source-head">
            <SourceBubble capture={capture} size={40} />
            <span className="inbox-text">
              <b>{captureSource(capture)}</b>
              <span>
                {whenAt(capture.notificationReceivedAt ?? at)}
                {ago && <span className="capture-ago">, {ago}</span>}
              </span>
            </span>
            {pill && (
              <span className="tone-pill" data-tone={pill.tone}>
                {pill.label}
              </span>
            )}
          </div>
          {capture.sourceType === 'notification' && <blockquote className="source-quote">“{capture.notificationBody ?? capture.sourceText ?? ''}”</blockquote>}
          {capture.sourceType === 'text' && (
            <div className="source-chat">
              <blockquote>{capture.sourceText ?? captureName(capture)}</blockquote>
            </div>
          )}
          {capture.sourceType === 'image' &&
            (photo === undefined ? (
              <div className="source-photo" aria-busy="true" />
            ) : photo ? (
              <ReceiptPhotoButton className="source-photo" src={photo} alt={`Receipt from ${captureName(capture)}`} />
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
              'Type',
              null,
              TYPES.find((each) => each.value === type)!.label,
              type,
              TYPES.map((each) => ({ value: each.value, label: each.label })),
              (value) => set(retypeEdits(capture, value)),
            )}
            {type !== 'transfer' &&
              row(
                'Category',
                category ? <Bubble icon={category.icon} color={category.color} size={28} glyph={15} /> : null,
                category?.name ?? 'Pick a category',
                next.categoryId,
                categories.map((each) => ({ value: each.id, label: each.name, lead: <Bubble icon={each.icon} color={each.color} size={28} glyph={15} /> })),
                (id) => set({ categoryId: id }),
                { suggested, action: newCategoryAction(() => setCreating(true)) },
              )}
            {creating && (
              <NewCategoryDialog
                ledger={ledger}
                type={kind}
                onClose={(made) => {
                  setCreating(false);
                  if (made) set({ categoryId: made.id });
                }}
              />
            )}
            {row(
              type === 'transfer' ? 'From' : 'Wallet',
              wallet ? <Bubble icon={wallet.icon} color={wallet.color} size={28} glyph={15} /> : <Glyph name="wallet-outline" size={18} />,
              wallet?.name ?? 'Pick a wallet',
              next.walletId,
              walletOptions(),
              (id) => set({ walletId: id }),
              { tone: needsWallet ? 'lemon' : undefined },
            )}
            {type === 'transfer' &&
              row(
                'To',
                to ? <Bubble icon={to.icon} color={to.color} size={28} glyph={15} /> : null,
                to?.name ?? 'Pick a wallet',
                next.transferToWalletId,
                walletOptions(next.walletId),
                (id) => set({ transferToWalletId: id }),
                { tone: to ? undefined : 'lemon' },
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
                {capture.notificationTitle ?? 'Bank'} alerts from {captureName(next)} <Glyph name="arrow-right" size={15} />{' '}
                <span className="facts rule-into">{filedAs(next.categoryId, next.walletId)}</span>
              </p>
              <div className="rule-head">
                <span className="caps">Would have matched</span>
                <span className="num rule-meta">
                  {matches.length
                    ? `${matches.length} ${matches.length === 1 ? 'alert' : 'alerts'} this month, ${formatMoney(sum(matches), capture.currency)} in total`
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
                        <span className="facts">
                          <span>{whenAt(match.transactionDate)}</span>
                          {filedAs(match.categoryId, match.walletId)}
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
                  <span className="facts">{filedAs(next.categoryId, next.walletId)}</span>
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
                    {history.length} {history.length === 1 ? 'time' : 'times'}, {formatMoney(sum(history), capture.currency)} in total
                  </span>
                </div>
                {history.slice(0, 4).map((each) => {
                  const filed = each.categoryId ? projection.categoriesById[each.categoryId] : undefined;
                  return (
                    <div key={each.id} className="history-row">
                      <Bubble icon={filed?.icon} color={filed?.color} size={30} glyph={16} />
                      <span className="inbox-text">
                        <b>{dayLabel(calendar.dayKey(each.transactionDate), calendar.dayKey(now))}</b>
                        <span className="facts">{filedAs(each.categoryId, each.walletId)}</span>
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
          {needsWallet && !picked ? 'Pick a wallet' : 'Approve'}
          <span className="kbd" data-only="sidebar rail rail-one-column">
            A
          </span>
        </button>
      </div>
    </section>
  );
}
