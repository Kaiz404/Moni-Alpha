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
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Glyph } from '@/components/ledger/glyph';
import { SidePanel } from '@/components/ledger/side-panel';
import { useQueryParams, useStepBack } from '@/components/ledger/use-query-param';
import { showToast } from '@/components/shell/shell-store';
import { applyPlan, commit, reviewContext, reviewView } from '@/lib/ledger/commit';
import { rowWhen } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { approvedText, captureName, notMineText, parseReviewView, waitingCount, waitingLine, type ReviewView } from '@/lib/review-view';
import { useScreenKeys } from '@/lib/screen-keys';
import { CapturePane } from './capture-pane';
import { Fact } from './fact';
import { CaughtUp, RecentList } from './review-done';
import { SourceBubble } from './source-bubble';
import '@/components/ledger/ledger.css';
import '@/components/ledger/table-pane.css';
import './review.css';

/** The stored row a decision closes, kept so its Undo can put the capture back as it was. */
function storedRow(id: string): StoredRow<'proposed_transactions'> | null {
  const row = (moniStore().proposedTransactions$.peek() as Record<string, StoredRow<'proposed_transactions'>> | undefined)?.[id];
  return row ? { ...row } : null;
}

function isLive(id: string): boolean {
  const row = storedRow(id);
  return row !== null && !row.deleted;
}

/**
 * Review on the web (W2-Review on W2-Home, #104): Home's review card opens it in the side panel (#106). `?review=` says what it shows, so the palette, G R, chat and
 * Budget's rows land on it. On the phone layout it is the pushed Review page, one capture at a time.
 */
export function ReviewDrawer({ ledger }: { ledger: Ledger }) {
  const [params, setParams] = useQueryParams();
  const view = parseReviewView(params.get('review'));
  // Kept here, not in the body, so closing the drawer and opening it again keeps what was picked.
  const [drafts, setDrafts] = useState<Record<string, ReviewEdits>>({});
  const [similar, setSimilar] = useState<Record<string, boolean>>({});
  const close = useStepBack(view !== null, () => setParams({ review: null, capture: null }));
  return (
    <SidePanel
      label="Review"
      name="review"
      back={view === 'recent' ? 'Review' : 'Home'}
      onBack={view === 'recent' ? () => setParams({ review: 'deck' }) : close}
      open={view !== null && ledger.loaded}
      onClose={close}
    >
      {view && ledger.loaded && (
        <ReviewBody
          ledger={ledger}
          view={view}
          asked={params.get('capture')}
          setParams={setParams}
          onClose={close}
          drafts={drafts}
          setDrafts={setDrafts}
          similar={similar}
          setSimilar={setSimilar}
        />
      )}
    </SidePanel>
  );
}

function ReviewBody({
  ledger,
  view,
  asked,
  setParams,
  onClose,
  drafts,
  setDrafts,
  similar,
  setSimilar,
}: {
  ledger: Ledger;
  view: ReviewView;
  asked: string | null;
  setParams: (patch: Record<string, string | null>) => void;
  onClose: () => void;
  drafts: Record<string, ReviewEdits>;
  setDrafts: Dispatch<SetStateAction<Record<string, ReviewEdits>>>;
  similar: Record<string, boolean>;
  setSimilar: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const { projection, currency, calendar, now, userId } = ledger;
  const [newestFirst, setNewestFirst] = useState(false);
  const oldestFirst = inboxOrder(ledger.waiting);
  const queue = newestFirst ? [...oldestFirst].reverse() : oldestFirst;
  const open = queue.find((capture) => capture.id === asked) ?? queue[0] ?? null;
  const index = open ? queue.indexOf(open) : -1;
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const picked = queue.filter((capture) => selected.has(capture.id));
  const edited = (capture: FinanceProposal) => editedProposal(capture, drafts[capture.id] ?? {});
  const empty = queue.length === 0;

  // The URL catches up a moment after a key, so keys pressed quickly read the capture just opened here.
  const opening = useRef<string | null>(null);
  const current = () => queue.find((capture) => capture.id === opening.current) ?? open;
  const openAt = (id: string | null, next: ReviewView = view === 'recent' ? 'deck' : view) => {
    opening.current = id;
    setParams({ review: next, capture: id });
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

  /** After a decision the drawer moves on to the capture below the decided one, as the deck does. */
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
    const plansView = reviewView(projection);
    const before = ready.map((capture) => storedRow(capture.id));
    const plans: Planned<ReviewChanges>[] = ready.map((capture) =>
      planReview(
        capture,
        kind === 'approve' ? { kind: 'approve', edits: drafts[capture.id], similar: similar[capture.id] ?? false } : { kind: 'notMine' },
        plansView,
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
    if (view === 'recent') {
      if (key !== 'Escape') return false;
      setParams({ review: 'deck' });
      return true;
    }
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
        if (view !== 'list' || !target || (event.target instanceof Element && event.target.closest('button, a, [role="checkbox"], [role="option"]'))) return false;
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
        else onClose();
        return true;
      default:
        return false;
    }
  });

  const deck = (capture: FinanceProposal) => (
    <CapturePane
      ledger={ledger}
      capture={capture}
      position={`${index + 1} of ${queue.length}`}
      edits={drafts[capture.id] ?? {}}
      onEdits={(next) => setDrafts((current) => ({ ...current, [capture.id]: next }))}
      similar={similar[capture.id] ?? false}
      onSimilar={(on) => setSimilar((current) => ({ ...current, [capture.id]: on }))}
      picked={picked.length}
      onMove={move}
      onApprove={() => decide('approve')}
      onNotMine={() => decide('notMine')}
    />
  );
  const allState = picked.length === 0 ? 'false' : picked.length === queue.length ? 'true' : 'mixed';
  const recent = view === 'recent';

  return (
    <div className="review-drawer" data-screen="review" data-loaded="" data-view={view}>
      <header className="drawer-head">
        <button type="button" className="icon-round icon-round-line press" data-only="phone" aria-label="Back" onClick={recent && !empty ? () => setParams({ review: 'deck' }) : onClose}>
          <Glyph name="chevron-left" size={20} />
        </button>
        <div className="drawer-titles">
          <h2 className="drawer-title">{recent ? 'Recently reviewed' : 'Review'}</h2>
          <span className="meta num">{recent ? 'Last 30 days' : waitingLine(queue, currency)}</span>
        </div>
        {!recent && !empty && (
          <div className="seg-tabs" role="radiogroup" aria-label="Show" data-only="sidebar rail rail-one-column">
            {(['deck', 'list'] as const).map((each) => (
              <button key={each} type="button" role="radio" aria-checked={view === each} onClick={() => setParams({ review: each })}>
                {each === 'deck' ? 'One by one' : `All ${queue.length}`}
              </button>
            ))}
          </div>
        )}
      </header>

      {recent ? (
        <RecentList ledger={ledger} titled={false} />
      ) : empty ? (
        <CaughtUp ledger={ledger} now={now} />
      ) : view === 'list' ? (
        <>
        {open && (
          <div className="review-phone-deck" data-only="phone">
            {deck(open)}
          </div>
        )}
        <section aria-label="Captures" className="review-inbox" data-only="sidebar rail rail-one-column">
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
            <button type="button" className="inbox-sort press" onClick={() => setNewestFirst(!newestFirst)}>
              <Glyph name="swap-vertical" size={18} />
              {newestFirst ? 'Newest first' : 'Oldest first'}
            </button>
          </div>
          <div role="grid" aria-label="Captures waiting" className="inbox-rows">
            {queue.map((capture) => {
              const next = edited(capture);
              const wallet = next.walletId ? projection.walletsById[next.walletId] : undefined;
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
                  onClick={() => openAt(capture.id, 'deck')}
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
                    <span className="facts">
                      <Fact icon={category?.icon ?? 'help-circle-outline'} color={category?.color ?? null}>
                        {category?.name ?? 'No category'}
                      </Fact>
                      {wallet && (
                        <Fact icon={wallet.icon} color={wallet.color}>
                          {wallet.name}
                        </Fact>
                      )}
                    </span>
                  </span>
                  <span className="inbox-end">
                    <span className="num inbox-amount">{formatMoney(next.amountMinor ?? 0, capture.currency)}</span>
                    <span className="num meta">{rowWhen(capture.transactionDate ?? capture.createdAt, now, calendar)}</span>
                    {pill && (
                      <span className="tone-pill" data-tone={pill.tone}>
                        {pill.label}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {picked.length > 0 && (
            <div role="toolbar" aria-label="Selected captures" className="bulk-bar review-bulk motion-rise">
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
          )}
        </section>
        </>
      ) : (
        open && deck(open)
      )}

      {!recent && !empty && (
        <button type="button" className="recent-link press" onClick={() => setParams({ review: 'recent' })}>
          <Glyph name="history" size={20} />
          <span>Recently reviewed</span>
          <Glyph name="chevron-right" size={20} />
        </button>
      )}
    </div>
  );
}
