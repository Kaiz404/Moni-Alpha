'use client';

import { correctBalance, formatMoney, parseBalanceInput, planCheckIn, walletToCheckIn } from '@repo/core';
import { minorToNumber } from '@repo/types';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { Bubble } from '@/components/ledger/glyph';
import { commit, planContext } from '@/lib/ledger/commit';
import type { Ledger } from '@/lib/ledger/use-ledger';
import './check-in.css';

/**
 * The balance check-in answered in place: That's right, Fix it, Not now. The phone layout shows it at the
 * foot of Home, as the phone does; the landscape web shows it on All wallets, beside the balances it asks about.
 */
export function CheckInCard({ ledger, only }: { ledger: Ledger; only: string }) {
  const { wallets, balances, currency, transactions, now, calendar, projection, userId } = ledger;
  const lastUsed = useMemo(() => {
    const seen: Record<string, string> = {};
    for (const transaction of transactions)
      for (const id of [transaction.walletId, transaction.transferToWalletId]) if (id && !seen[id]) seen[id] = transaction.transactionDate;
    return seen;
  }, [transactions]);
  const [dismissed, setDismissed] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const ask = dismissed ? null : walletToCheckIn({ wallets, balancesByWallet: balances, lastUsedByWallet: lastUsed, currency, now, calendar });
  if (!ask) return null;
  const fixing = draft !== null;

  const answer = (typed: string | null) => {
    const value = typed === null ? null : parseBalanceInput(typed);
    if (typed !== null && value === null) return;
    const correction = value === null ? null : correctBalance({ balance: minorToNumber(ask.balanceMinor) }, value);
    setDraft(null);
    commit(planCheckIn(ask.wallet.id, correction, projection, planContext(userId)), correction ? `${ask.wallet.name} fixed` : `${ask.wallet.name} checked`);
  };

  return (
    <section className="check-in motion-rise" aria-label="Check-in" data-only={only}>
      <div className="check-in-wallet">
        <Bubble icon={ask.wallet.icon} color={ask.wallet.color} size={32} glyph={17} />
        <span className="check-in-name">{ask.wallet.name}</span>
        <span className="num check-in-balance">{formatMoney(ask.balanceMinor, currency)}</span>
      </div>
      <span className="caps check-in-caps">Check-in{ask.daysAgo !== null ? `, last done ${ask.daysAgo} days ago` : ''}</span>
      <span className="check-in-question num">
        Is {ask.wallet.name} still {formatMoney(ask.balanceMinor, currency)}?
      </span>
      {fixing ? (
        <form
          className="check-in-fix"
          onSubmit={(event) => {
            event.preventDefault();
            answer(draft);
          }}
        >
          <label className="check-in-field">
            <span className="sr-only">{ask.wallet.name} balance now</span>
            <input inputMode="decimal" autoFocus value={draft} placeholder={minorToNumber(ask.balanceMinor).toFixed(2)} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button type="button" className="icon-round press" aria-label="Cancel" onClick={() => setDraft(null)}>
            <Icon name="close" size={18} />
          </button>
          <button type="submit" className="icon-round icon-round-ink press" aria-label="Save" disabled={parseBalanceInput(draft) === null}>
            <Icon name="check" size={18} />
          </button>
        </form>
      ) : (
        <div className="check-in-actions">
          <button type="button" className="btn btn-mint check-in-btn press" onClick={() => answer(null)}>
            <Icon name="check" size={18} />
            That&apos;s right
          </button>
          <button type="button" className="btn btn-paper check-in-btn press" onClick={() => setDraft('')}>
            Fix it
          </button>
          <button type="button" className="not-now press" onClick={() => setDismissed(true)}>
            Not now
          </button>
        </div>
      )}
    </section>
  );
}
