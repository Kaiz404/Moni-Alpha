'use client';

import {
  combine,
  editedProposal,
  formatMoney,
  inboxOrder,
  planReopen,
  planReview,
  reviewStatus,
  timesFiled,
  type FinanceProposal,
  type Planned,
  type ReviewChanges,
  type ReviewEdits,
  type StoredRow,
} from '@repo/core';
import { useRef, useState } from 'react';
import { Glyph } from '@/components/ledger/glyph';
import { useQueryParams } from '@/components/ledger/use-query-param';
import { Page } from '@/components/shell/page';
import { showToast } from '@/components/shell/shell-store';
import { applyPlan, commit, reviewContext, reviewView } from '@/lib/ledger/commit';
import { captureSource, clockTime } from '@/lib/ledger/format';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { approvedText, captureName, notMineText, waitingCount, waitingLine } from '@/lib/review-view';
import { useScreenKeys } from '@/lib/screen-keys';
import { CapturePane } from './capture-pane';
import { CaughtUp, RecentList } from './review-done';
import { SourceBubble } from './source-bubble';
import '@/components/ledger/ledger.css';
import './review.css';

export function ReviewScreen() {
  const ledger = useLedger();
  if (!ledger.loaded) {
    return (
      <Page title="Review" phone="pushed">
        <div className="review" aria-busy="true">
          <div className="review-side">
            <div className="card skeleton" style={{ height: 320 }} />
          </div>
        </div>
      </Page>
    );
  }
  return <ReviewLoaded ledger={ledger} />;
}

/** The stored row a decision closes, kept so its Undo can put the capture back as it was. */
function storedRow(id: string): StoredRow<'proposed_transactions'> | null {
  const row = (moniStore().proposedTransactions$.peek() as Record<string, StoredRow<'proposed_transactions'>> | undefined)?.[id];
  return row ? { ...row } : null;
}

function isLive(id: string): boolean {
  const row = storedRow(id);
  return row !== null && !row.deleted;
}

function ReviewLoaded({ ledger }: { ledger: Ledger }) {
  const { projection, currency, calendar, now, userId } = ledger;
  const [params, setParams] = useQueryParams();
  const queue = inboxOrder(ledger.waiting);
  const asked = params.get('capture');
  const open = queue.find((capture) => capture.id === asked) ?? queue[0] ?? null;
  const index = open ? queue.indexOf(open) : -1;
  const showRecent = params.get('view') === 'recent';
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [drafts, setDrafts] = useState<Record<string, ReviewEdits>>({});
  const [similar, setSimilar] = useState<Record<string, boolean>>({});
  const picked = queue.filter((capture) => selected.has(capture.id));
  const edited = (capture: FinanceProposal) => editedProposal(capture, drafts[capture.id] ?? {});

  // The URL catches up a moment after a key, so keys pressed quickly read the capture just opened here.
  const opening = useRef<string | null>(null);
  const current = () => queue.find((capture) => capture.id === opening.current) ?? open;
  const openAt = (id: string | null) => {
    opening.current = id;
    setParams({ capture: id, view: null });
  };
  const move = (by: 1 | -1) => {
    if (!queue.length) return;
    const at = queue.indexOf(current()!);
    const next = at < 0 ? 0 : Math.min(queue.length - 1, Math.max(0, at + by));
    openAt(queue[next]!.id);
  };
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** After a decision the inbox moves on to the capture below the decided one, as the deck does. */
  const moveOn = (from: FinanceProposal | null, decided: ReadonlySet<string>) => {
    const rest = queue.filter((capture) => !decided.has(capture.id));
    const after = queue.slice(Math.max(0, from ? queue.indexOf(from) : 0)).find((capture) => !decided.has(capture.id));
    openAt((after ?? rest.at(-1))?.id ?? null);
  };

  const decide = (kind: 'approve' | 'notMine') => {
    const focus = current();
    const targets = picked.length ? picked : focus ? [focus] : [];
    if (!targets.length) return;
    const ready = kind === 'approve' ? targets.filter((capture) => edited(capture).walletId) : targets;
    const skipped = targets.filter((capture) => !ready.includes(capture));
    if (!ready.length) {
      showToast({ text: 'Pick a wallet first.', tone: 'error' });
      return;
    }
    const ctx = reviewContext(userId);
    const view = reviewView(projection);
    const before = ready.map((capture) => storedRow(capture.id));
    const plans: Planned<ReviewChanges>[] = ready.map((capture) =>
      planReview(
        capture,
        kind === 'approve' ? { kind: 'approve', edits: drafts[capture.id], similar: similar[capture.id] ?? false } : { kind: 'notMine' },
        view,
        ctx,
      ),
    );
    const done = commit(
      combine(plans),
      (results) => {
        if (kind === 'notMine') return notMineText(results.length);
        const one = ready.length === 1 ? edited(ready[0]!) : null;
        const category = one?.categoryId ? (projection.categoriesById[one.categoryId]?.name ?? null) : null;
        return approvedText({ approved: ready, category, ruleSaved: results.some((result) => result.rule !== null), skipped });
      },
      (results) => {
        const at = new Date().toISOString();
        applyPlan(
          combine(
            results.flatMap((changes, i) => {
              const row = before[i];
              return row ? [planReopen(row, changes, isLive(row.id), { now: at })] : [];
            }),
          ),
        );
        openAt(ready[0]!.id);
      },
    );
    if (!done) return;
    setSelected(new Set());
    moveOn(focus, new Set(ready.map((capture) => capture.id)));
  };

  useScreenKeys((key, event) => {
    switch (key) {
      case 'j':
        move(1);
        return true;
      case 'k':
        move(-1);
        return true;
      case ' ': {
        // A focused button or box takes Space itself.
        const target = current();
        if (!target || (event.target instanceof Element && event.target.closest('button, a, [role="checkbox"], [role="option"]'))) return false;
        toggle(target.id);
        return true;
      }
      case 'a':
        decide('approve');
        return true;
      case 'x':
        decide('notMine');
        return true;
      case 'Escape':
        if (selected.size) setSelected(new Set());
        else if (showRecent) setParams({ view: null });
        else if (asked) setParams({ capture: null });
        else return false;
        return true;
      default:
        return false;
    }
  });

  const allState = picked.length === 0 ? 'false' : picked.length === queue.length ? 'true' : 'mixed';
  const empty = queue.length === 0;

  return (
    <Page title="Review" phone="pushed" meta={waitingLine(queue, currency)}>
      <div className="review" data-screen="review" data-loaded="">
        <div className="review-side">
          <section aria-label="Captures" className="card review-inbox" data-only="sidebar rail rail-one-column">
            {!empty && (
              <div className="inbox-tools">
                <button
                  type="button"
                  role="checkbox"
                  className="cbx"
                  aria-checked={allState}
                  aria-label="Select all"
                  onClick={() => setSelected(allState === 'true' ? new Set() : new Set(queue.map((capture) => capture.id)))}
                >
                  {allState !== 'false' && <Glyph name={allState === 'true' ? 'check-bold' : 'minus-thick'} size={15} />}
                </button>
                <span className="num inbox-count">{waitingCount(queue.length)}</span>
                <span className="hint-keys">
                  <span className="kbd">J</span>
                  <span className="kbd">K</span>
                  move
                  <span className="kbd">Space</span>
                  select
                </span>
              </div>
            )}
            <div role="grid" aria-label="Captures waiting" className="inbox-rows">
              {queue.map((capture) => {
                const next = edited(capture);
                const wallet = next.walletId ? ledger.walletNames[next.walletId] : null;
                const category = next.categoryId ? projection.categoriesById[next.categoryId] : undefined;
                const pill = reviewStatus({
                  hasWallet: Boolean(next.walletId),
                  paired: Boolean(capture.pairing),
                  maybeDuplicate: false,
                  timesFiled: timesFiled(next, ledger.transactions),
                });
                return (
                  <div
                    key={capture.id}
                    role="row"
                    className="inbox-row"
                    aria-selected={capture.id === open?.id}
                    data-capture={capture.id}
                    onClick={() => openAt(capture.id)}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      className="cbx"
                      aria-checked={selected.has(capture.id)}
                      aria-label={`Select ${captureName(capture)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(capture.id);
                      }}
                    >
                      {selected.has(capture.id) && <Glyph name="check-bold" size={15} />}
                    </button>
                    <SourceBubble capture={capture} size={40} />
                    <span className="inbox-text">
                      <b className="inbox-name">{captureName(next)}</b>
                      <span>
                        {captureSource(capture)} · {clockTime(capture.transactionDate ?? capture.createdAt, calendar.zone)}
                      </span>
                      <span>
                        {category?.name ?? 'No category'} ·{' '}
                        {wallet ?? <span className="pick-wallet">Pick a wallet</span>}
                      </span>
                    </span>
                    <span className="inbox-end">
                      <span className="num inbox-amount">{formatMoney(next.amountMinor ?? 0, capture.currency)}</span>
                      {pill && (
                        <span className="tone-pill" data-tone={pill.tone}>
                          {pill.label}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
              {empty && (
                <div className="inbox-empty">
                  <span className="inbox-empty-check">
                    <Glyph name="check" size={22} />
                  </span>
                  Nothing waiting. New captures land here.
                </div>
              )}
            </div>
          </section>
          <button type="button" className="card recent-link press" aria-pressed={showRecent} onClick={() => setParams({ view: showRecent ? null : 'recent' })}>
            <span className="recent-link-icon">
              <Glyph name="history" size={20} />
            </span>
            <span className="inbox-text">
              <b>Recently reviewed</b>
              <span>Last 30 days of Approve and Not mine</span>
            </span>
            <Glyph name="chevron-right" size={20} />
          </button>
          <div aria-label="Keyboard" className="review-keys" data-only="sidebar rail">
            {(
              [
                [['J', 'K'], 'Next, previous'],
                [['Space'], 'Select'],
                [['A'], 'Approve'],
                [['X'], 'Not mine'],
                [['Ctrl Z'], 'Undo'],
              ] as const
            ).map(([keys, label]) => (
              <span key={label} className="review-key">
                {keys.map((each) => (
                  <span key={each} className="kbd">
                    {each}
                  </span>
                ))}
                {label}
              </span>
            ))}
          </div>
        </div>
        {picked.length > 0 && (
          <div className="bulk-slot review-bulk" data-only="sidebar rail rail-one-column">
            <div role="toolbar" aria-label="Selected captures" className="bulk-bar motion-rise">
              <button type="button" className="bulk-close press" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
                <Glyph name="close" size={20} />
              </button>
              <span className="bulk-count num">{picked.length} selected</span>
              <span className="bulk-rule" aria-hidden="true" />
              <button type="button" className="bulk-btn bulk-approve press" onClick={() => decide('approve')}>
                <Glyph name="check" size={18} />
                Approve
                <span className="kbd kbd-on-ink">A</span>
              </button>
              <button type="button" className="bulk-btn press" onClick={() => decide('notMine')}>
                <Glyph name="close" size={18} />
                Not mine
                <span className="kbd kbd-on-ink">X</span>
              </button>
            </div>
          </div>
        )}
        <div className="detail-scrim review-scrim" data-open={asked || showRecent ? '' : undefined} onMouseDown={() => setParams({ capture: null, view: null })} />
        {showRecent ? (
          <aside className="review-pane review-pane-list" aria-label="Recently reviewed" data-open="">
            <RecentList ledger={ledger} onClose={() => setParams({ view: null })} />
          </aside>
        ) : open ? (
          <CapturePane
            key="capture"
            ledger={ledger}
            capture={open}
            position={`${index + 1} of ${queue.length}`}
            asked={Boolean(asked)}
            edits={drafts[open.id] ?? {}}
            onEdits={(next) => setDrafts((current) => ({ ...current, [open.id]: next }))}
            similar={similar[open.id] ?? false}
            onSimilar={(on) => setSimilar((current) => ({ ...current, [open.id]: on }))}
            picked={picked.length}
            onMove={move}
            onClose={() => setParams({ capture: null })}
            onApprove={() => decide('approve')}
            onNotMine={() => decide('notMine')}
          />
        ) : (
          <aside className="review-pane review-pane-list" aria-label="All caught up" data-open="">
            <CaughtUp ledger={ledger} now={now} />
          </aside>
        )}
      </div>
    </Page>
  );
}

