'use client';

import { monthName } from '@repo/core';
import { updateProfilePreferences } from '@repo/data';
import { userPreferencesSchema } from '@repo/types';
import Link from 'next/link';
import { Cat } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Glyph } from '@/components/ledger/glyph';
import { useShellApi } from '@/components/shell/shell-context';
import { showToast } from '@/components/shell/shell-store';
import { useAiConsent } from '@/lib/ai';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { sourceOf } from '@/lib/ledger/format';
import { moniStore } from '@/lib/moni-store';
import { currencyName, phoneLinkMail, setupChecklist, showsChecklist, usesPhoneApp, type ChecklistItem } from '@/lib/setup';
import { factText } from '@/lib/site-facts';

/** Home's first-run steps (W2-Onboarding, Done), or null once they are all done or the card was closed. */
export function useSetupChecklist(ledger: Ledger): ChecklistItem[] | null {
  const consent = useAiConsent();
  const items = setupChecklist({
    currency: ledger.currency,
    currencyName: ledger.mounted ? currencyName(ledger.currency) : ledger.currency,
    aiOn: consent?.kind === 'answered' ? consent.on : null,
    wallets: ledger.wallets.length,
    monthName: monthName(ledger.month.month),
    budgetSet: ledger.month.budgetMinor !== null,
    phoneUsed: usesPhoneApp({
      sources: ledger.transactions.map((transaction) => sourceOf(transaction.metadata)),
      captures: ledger.waiting.length + ledger.reviewed.length,
      linkedWallets: ledger.wallets.filter((wallet) => wallet.notificationPackage).length,
    }),
  });
  return ledger.loaded && showsChecklist(items, ledger.setup) ? items : null;
}

async function setHidden(hidden: boolean): Promise<void> {
  const store = moniStore();
  const previous = store.profilePreferences$.peek();
  store.profilePreferences$.set({ ...userPreferencesSchema.parse(previous ?? {}), setup_checklist_hidden: hidden });
  try {
    store.profilePreferences$.set(await updateProfilePreferences(store.supabase, { setup_checklist_hidden: hidden }));
  } catch {
    store.profilePreferences$.set(previous);
    showToast({ text: "Couldn't close Get set up. Try again.", tone: 'error' });
  }
}

/** The Mint Get set up card in the Review slot: each step ticks off in place, with its one action. */
export function SetupCard({ items }: { items: ChecklistItem[] }) {
  const { user } = useShellApi();
  const done = items.filter((item) => item.done).length;
  const action = (item: ChecklistItem) => {
    if (item.done) return null;
    if (item.key === 'budget')
      return (
        <Link href="/budget" className="btn btn-ink home-setup-act press">
          Set budget
        </Link>
      );
    if (item.key === 'phone')
      return (
        <a href={phoneLinkMail(user.email, factText('googlePlayUrl'))} className="btn btn-ink home-setup-act press">
          Send link
        </a>
      );
    if (item.key === 'ai')
      return (
        <Link href="/settings/ai" className="btn btn-ink home-setup-act press">
          Choose
        </Link>
      );
    return null;
  };
  return (
    <section aria-label="Get set up" className="card home-setup" data-card="review">
      <div className="home-setup-head">
        <Cat mood="happy" size={56} id="home-setup-cat" />
        <div className="home-setup-titles">
          <h2 className="card-title">Get set up</h2>
          <span className="num home-setup-count">
            {done} of {items.length} done
          </span>
        </div>
        <button
          type="button"
          className="icon-round home-setup-close press"
          aria-label="Hide Get set up"
          onClick={() => {
            void setHidden(true);
            showToast({ text: 'Get set up is hidden', tone: 'done', undo: () => void setHidden(false) });
          }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <span className="home-setup-bar" aria-hidden="true">
        <span style={{ width: `${(done / items.length) * 100}%` }} />
      </span>
      <ol className="home-setup-list">
        {items.map((item) => (
          <li key={item.key} className="home-setup-row" data-done={item.done || undefined}>
            <span className="home-setup-dot">{item.done && <Glyph name="check-bold" size={16} />}</span>
            <span className="row-text">
              <span className="row-title">{item.title}</span>
              <span className="row-meta">{item.line}</span>
            </span>
            {action(item)}
          </li>
        ))}
      </ol>
    </section>
  );
}
