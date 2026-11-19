'use client';

import {
  combine,
  familiarity,
  formatMoney,
  planCaptureWallet,
  planReview,
  timesFiled,
  usualCaptures,
  type FinanceProposal,
} from '@repo/core';
import type { MinorAmount } from '@repo/types';
import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { commit, planContext, reviewContext, reviewView } from '@/lib/ledger/commit';
import { captureSource, clockTime } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';
import type { ChecklistItem } from '@/lib/setup';
import { SetupCard } from './setup-card';

const SHOWN = 3;

function waitingTotal(captures: readonly FinanceProposal[], currency: string): string {
  const total = captures.filter((each) => each.currency === currency).reduce((sum, each) => sum + Number(each.amountMinor ?? 0), 0);
  return `${formatMoney(total as MinorAmount, currency)} waiting`;
}

/** W2-Home's lilac card: the newest captures with Approve in place, and "Approve all N usual". */
export function ReviewCard({ ledger, setup }: { ledger: Ledger; setup: ChecklistItem[] | null }) {
  const { waiting, transactions, projection, walletNames, currency, calendar, wallets, userId } = ledger;
  const usual = usualCaptures(waiting, transactions);
  const [picking, setPicking] = useState<string | null>(null);
  if (setup) return <SetupCard items={setup} />;
  if (waiting.length === 0) return <CaughtUp />;

  const approve = (captures: readonly FinanceProposal[]) => {
    const ctx = reviewContext(userId);
    const view = reviewView(projection);
    commit(combine(captures.map((capture) => planReview(capture, { kind: 'approve' }, view, ctx))), (results) =>
      results.length === 1 ? `${captures[0]!.merchant ?? 'Capture'} approved` : `${results.length} approved`,
    );
  };
  const pickWallet = (capture: FinanceProposal, walletId: string) => {
    setPicking(null);
    commit(planCaptureWallet(capture.id, walletId, projection, planContext(userId)), `${walletNames[walletId] ?? 'Wallet'} picked`);
  };
  const title = waiting.length === 1 ? '1 capture to review' : `${waiting.length} captures to review`;
  const left = waiting.filter((capture) => !usual.includes(capture));

  return (
    <section aria-label="Captures to review" className="card review-card" data-card="review">
      <div className="review-head">
        <div className="review-titles">
          <h2 className="card-title num">{title}</h2>
          <span className="review-sub num">{waitingTotal(waiting, currency)}</span>
        </div>
        <Link href="/review" className="review-link press" data-only="sidebar rail rail-one-column">
          Review
          <Icon name="chevron-right" size={18} />
        </Link>
        <Link href="/review" className="btn btn-ink review-pill press" data-only="phone">
          Review
          <Icon name="chevron-right" size={18} />
        </Link>
      </div>
      <ul className="review-list" data-only="sidebar rail rail-one-column">
        {waiting.slice(0, SHOWN).map((capture) => {
          const known = familiarity(timesFiled(capture, transactions));
          const category = capture.categoryId ? projection.categoriesById[capture.categoryId] : undefined;
          const who = !capture.walletId ? 'Needs a wallet' : known === 'usual' ? 'Usual for you' : known === 'seen' ? 'Seen before' : captureSource(capture);
          const where = capture.walletId ? (walletNames[capture.walletId] ?? 'Wallet') : captureSource(capture);
          const merchant = capture.merchant ?? capture.description ?? 'Capture';
          return (
            <li key={capture.id} className="review-row">
              <Link href="/review" className="review-row-link">
                <Bubble icon={category?.icon ?? 'help-circle-outline'} color={null} size={34} glyph={17} dashed />
                <span className="row-text">
                  <span className="review-row-top">
                    <span className="row-title">{merchant}</span>
                    <span className="num row-amount">{formatMoney(capture.amountMinor ?? 0, capture.currency)}</span>
                  </span>
                  <span className="row-meta" data-tone={capture.walletId ? 'lilac' : 'lemon'}>
                    {who} · {where} · {clockTime(capture.transactionDate ?? capture.createdAt, calendar.zone)}
                  </span>
                </span>
              </Link>
              {capture.walletId ? (
                <button type="button" className="btn btn-key review-approve press" aria-label={`Approve ${merchant}`} onClick={() => approve([capture])}>
                  <Icon name="check" size={18} />
                  Approve
                </button>
              ) : (
                <span className="picker-anchor">
                  <button
                    type="button"
                    className="btn btn-sand review-approve press"
                    aria-haspopup="listbox"
                    aria-expanded={picking === capture.id}
                    aria-label={`Pick a wallet for ${merchant}`}
                    onClick={() => setPicking(picking === capture.id ? null : capture.id)}
                  >
                    <Glyph name="wallet-outline" size={18} />
                    Wallet
                    <Icon name="chevron-down" size={16} />
                  </button>
                  {picking === capture.id && (
                    <ul role="listbox" aria-label="Wallet" className="popover motion-pop">
                      {wallets
                        .filter((wallet) => wallet.currency === capture.currency)
                        .map((wallet) => (
                          <li key={wallet.id} role="option" aria-selected={false} tabIndex={0} className="popover-row" onClick={() => pickWallet(capture, wallet.id)}>
                            <Bubble icon={wallet.icon} color={wallet.color} size={28} glyph={15} />
                            {wallet.name}
                          </li>
                        ))}
                    </ul>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="grow-space" />
      {usual.length > 0 ? (
        <button type="button" className="btn btn-ink approve-usual press" data-only="sidebar rail rail-one-column" onClick={() => approve(usual)}>
          <Glyph name="check-all" size={20} />
          <span className="approve-usual-text">Approve all {usual.length} usual</span>
          <Icon name="chevron-right" size={20} />
        </button>
      ) : (
        left.length > 0 &&
        left.some((capture) => !capture.walletId) && (
          <span className="review-note motion-rise" data-only="sidebar rail rail-one-column">
            <Glyph name="information-outline" size={18} />
            {left.find((capture) => !capture.walletId)!.merchant ?? 'A capture'} needs a wallet before it can go in.
          </span>
        )
      )}
    </section>
  );
}

function CaughtUp() {
  return (
    <section aria-label="Captures to review" className="card review-card review-empty" data-card="review">
      <h2 className="card-title">Nothing to review</h2>
      <p className="review-sub">New captures from notifications, receipts and chat wait here until you say yes.</p>
    </section>
  );
}
