'use client';

import { dayLabel, formatMoney, formatSignedMoney, planReopen, type ReviewedProposal, type StoredRow } from '@repo/core';
import Link from 'next/link';
import { Cat } from '@/components/brand';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { commit } from '@/lib/ledger/commit';
import { captureSource, clockTime } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { caughtUpLine, captureName } from '@/lib/review-view';

/** Puts a Not mine capture back in Review, with Undo. */
function moveBack(proposal: ReviewedProposal) {
  const row = (moniStore().proposedTransactions$.peek() as Record<string, StoredRow<'proposed_transactions'>> | undefined)?.[proposal.id];
  if (!row) return;
  commit(planReopen({ ...row }, { transactionId: null, rule: null }, !row.deleted, { now: new Date().toISOString() }), `${captureName(proposal)} is back in Review`);
}

/** Recently reviewed: 30 days of Approve and Not mine, and Move back to Review for a Not mine. */
export function RecentList({ ledger, onClose }: { ledger: Ledger; onClose?: () => void }) {
  const { projection, calendar, now, walletNames } = ledger;
  const today = calendar.dayKey(now);
  return (
    <div className="recent-list" id="recently-reviewed">
      <div className="recent-head">
        <h2 className="card-title">Recently reviewed</h2>
        <span className="meta">Last 30 days of Approve and Not mine</span>
        {onClose && (
          <button type="button" className="icon-round icon-round-line press recent-close" aria-label="Close (Esc)" onClick={onClose}>
            <Glyph name="close" size={20} />
          </button>
        )}
      </div>
      {ledger.reviewed.length === 0 ? (
        <p className="meta recent-none">Nothing reviewed in the last 30 days.</p>
      ) : (
        <ul className="recent-rows">
          {ledger.reviewed.map((proposal) => {
            const notMine = proposal.status === 'rejected';
            const category = proposal.categoryId ? projection.categoriesById[proposal.categoryId] : undefined;
            const day = calendar.dayKey(proposal.reviewedAt);
            const when = day === today ? clockTime(proposal.reviewedAt, calendar.zone) : dayLabel(day, today);
            const where = notMine
              ? captureSource(proposal)
              : `${category?.name ?? 'No category'} · ${(proposal.walletId && walletNames[proposal.walletId]) || 'Wallet'}`;
            return (
              <li key={proposal.id} className="recent-row" data-status={proposal.status}>
                {notMine ? <Bubble icon="close" color={null} size={36} glyph={18} /> : <Bubble icon={category?.icon} color={category?.color} size={36} glyph={18} />}
                <span className="inbox-text">
                  <b>{captureName(proposal)}</b>
                  <span>
                    {notMine ? 'Not mine' : 'Approved'} · {where} · {when}
                  </span>
                </span>
                <span className="num recent-amount" data-tone={notMine ? 'quiet' : undefined}>
                  {notMine
                    ? formatMoney(proposal.amountMinor ?? 0, proposal.currency)
                    : formatSignedMoney(proposal.type ?? 'expense', proposal.amountMinor ?? 0, proposal.currency)}
                </span>
                {notMine && (
                  <button type="button" className="btn btn-out press move-back" onClick={() => moveBack(proposal)}>
                    Move back to Review
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * All caught up (W2-Review, W2-Empty): the celebrate cat once Kai has cleared captures today, today's
 * decisions, and Recently reviewed below. With nothing decided today there is nothing to celebrate, so
 * the pane says there is nothing to review and where captures come from.
 */
export function CaughtUp({ ledger, now }: { ledger: Ledger; now: Date }) {
  const { calendar, currency } = ledger;
  const today = calendar.dayKey(now);
  if (!ledger.reviewed.some((proposal) => calendar.dayKey(proposal.reviewedAt) === today)) {
    return (
      <div className="nothing-to-review">
        <div className="empty">
          <Cat mood="neutral" size={72} id="review-nothing" />
          <h2 className="empty-title">Nothing to review</h2>
          <p className="empty-line">New captures from notifications, receipts and chat wait here until you say yes.</p>
        </div>
        <p className="capture-from">
          <Glyph name="bell-outline" size={18} />
          {capturesFrom(ledger.wallets.map((wallet) => wallet.notificationAppLabel))}
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="caught-up rise">
        <Cat mood="celebrate" size={168} id="review-done" />
        <div className="caught-up-words">
          <h2 className="caught-up-title">All caught up</h2>
          <p className="num">{caughtUpLine(ledger.reviewed, calendar.dayKey(now), (at) => calendar.dayKey(at), currency)}</p>
          <div className="caught-up-actions">
            <Link href="/home" className="btn btn-ink press">
              Back to Home
            </Link>
            <Link href="/activity" className="btn btn-sand press">
              See it in Activity
            </Link>
          </div>
        </div>
      </div>
      <RecentList ledger={ledger} />
    </>
  );
}

/** "Captures come from Maybank and Touch 'n Go alerts on your phone." from the wallets linked to a banking app. */
export function capturesFrom(appLabels: readonly (string | null)[]): string {
  const apps = [...new Set(appLabels.filter((label): label is string => Boolean(label)))];
  if (!apps.length) return 'Captures come from bank alerts, receipts and Moni chat on your phone.';
  const named = apps.length === 1 ? apps[0] : `${apps.slice(0, -1).join(', ')} and ${apps.at(-1)}`;
  return `Captures come from ${named} alerts on your phone.`;
}
