'use client';

import { approvedRow, formatMoney, formatSignedMoney, planned, planReopen, type AutoAddRuleItem, type ReviewedProposal, type StoredRow } from '@repo/core';
import Link from 'next/link';
import { Cat } from '@/components/brand';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { commit } from '@/lib/ledger/commit';
import { captureSource, rowWhen } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { caughtUpLine, captureName } from '@/lib/review-view';
import { Fact } from './fact';

/** Puts a Not mine capture back in Review, with Undo. */
function moveBack(proposal: ReviewedProposal) {
  const row = (moniStore().proposedTransactions$.peek() as Record<string, StoredRow<'proposed_transactions'>> | undefined)?.[proposal.id];
  if (!row) return;
  commit(planReopen({ ...row }, { transactionId: null, rule: null }, !row.deleted, { now: new Date().toISOString() }), `${captureName(proposal)} is back in Review`);
}

/** Deletes a "Don't ask about similar" rule, so the next alert like it waits in Review again. Undo puts it back. */
function askAgain(item: AutoAddRuleItem) {
  commit(
    planned({ softDelete: [{ table: 'auto_add_rules', id: item.rule.id, at: new Date().toISOString() }] }, null),
    `Moni will ask about ${item.name} again`,
  );
}

/**
 * The rules "Don't ask about similar" made, beside the decisions that made them. A browser can't read
 * an Android app's icon, so each row shows the wallet that app is linked to, as the bank alerts do.
 */
function RuleList({ rules, wallets }: { rules: AutoAddRuleItem[]; wallets: Ledger['wallets'] }) {
  if (rules.length === 0) return null;
  return (
    <>
      <div className="recent-head">
        <h2 className="card-title">Don&apos;t ask about similar</h2>
      </div>
      <ul className="recent-rows" aria-label="Don't ask about similar">
        {rules.map((item) => {
          const app = wallets.find((wallet) => wallet.notificationPackage === item.rule.sourceApp);
          return (
            <li key={item.rule.id} className="recent-row" data-rule={item.rule.merchantKey}>
              {app ? (
                <Bubble icon={app.icon} color={app.color} size={36} glyph={18} label={app.notificationAppLabel ?? app.name} />
              ) : (
                <Bubble icon="bell-outline" color={null} size={36} glyph={18} label="Bank alert" />
              )}
              <span className="inbox-text">
                <b>{item.name}</b>
                <span>{item.line}</span>
              </span>
              <button type="button" className="btn btn-out press move-back" onClick={() => askAgain(item)}>
                Ask again
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Recently reviewed: 30 days of Approve and Not mine, and Move back to Review for a Not mine. */
export function RecentList({ ledger, titled = true }: { ledger: Ledger; titled?: boolean }) {
  const { projection, calendar, now, walletNames, aliases } = ledger;
  const lookups = { categoriesById: projection.categoriesById, walletNames, aliases };
  return (
    <div className="recent-list" id="recently-reviewed">
      {titled && <h3 className="recent-head caps">Recently reviewed</h3>}
      {ledger.reviewed.length === 0 ? (
        <p className="meta recent-none">Nothing reviewed in the last 30 days.</p>
      ) : (
        <ul className="recent-rows">
          {ledger.reviewed.map((proposal) => {
            const notMine = proposal.status === 'rejected';
            const proposed = proposal.categoryId ? projection.categoriesById[proposal.categoryId] : undefined;
            const row = approvedRow(proposal, projection.transactionsById, lookups);
            const category = row ? { name: row.category, icon: row.icon, color: row.color } : proposed;
            const when = rowWhen(proposal.reviewedAt, now, calendar);
            const walletId = (row && projection.transactionsById[row.id]?.walletId) || proposal.walletId;
            const wallet = walletId ? projection.walletsById[walletId] : undefined;
            return (
              <li key={proposal.id} className="recent-row" data-status={proposal.status}>
                {notMine ? <Bubble icon="close" color={null} size={36} glyph={18} /> : <Bubble icon={category?.icon} color={category?.color} size={36} glyph={18} />}
                <span className="inbox-text">
                  <b>{row?.title ?? captureName(proposal)}</b>
                  {notMine ? (
                    <span>Not mine, from {captureSource(proposal)}</span>
                  ) : (
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
                  )}
                </span>
                <span className="inbox-end">
                  <span className="num recent-amount" data-tone={notMine ? 'quiet' : undefined}>
                    {notMine
                      ? formatMoney(proposal.amountMinor ?? 0, proposal.currency)
                      : formatSignedMoney(proposal.type ?? 'expense', proposal.amountMinor ?? 0, proposal.currency)}
                  </span>
                  <span className="num meta">{when}</span>
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
      <RuleList rules={ledger.autoAddRules} wallets={ledger.wallets} />
    </div>
  );
}

/**
 * The drawer with nothing waiting (W2-Review, W2-Empty): the celebrate cat once Kai has cleared captures
 * today, with today's decisions, or else one line on where captures come from; Recently reviewed below.
 * Home's card already says there is nothing to review, so the drawer doesn't say it again.
 */
export function CaughtUp({ ledger, now }: { ledger: Ledger; now: Date }) {
  const { calendar, currency } = ledger;
  const today = calendar.dayKey(now);
  const cleared = ledger.reviewed.some((proposal) => calendar.dayKey(proposal.reviewedAt) === today);
  return (
    <>
      {cleared ? (
        <div className="caught-up rise">
          <Cat mood="celebrate" size={120} id="review-done" />
          <div className="caught-up-words">
            <h3 className="caught-up-title">All caught up</h3>
            <p className="num">{caughtUpLine(ledger.reviewed, today, (at) => calendar.dayKey(at), currency)}</p>
            <div className="caught-up-actions">
              <Link href="/activity" className="btn btn-sand press">
                See it in Activity
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <p className="capture-from">
          <Glyph name="bell-outline" size={18} />
          {capturesFrom(ledger.wallets.map((wallet) => wallet.notificationAppLabel))}
        </p>
      )}
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
