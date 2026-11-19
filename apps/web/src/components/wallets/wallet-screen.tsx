'use client';

import {
  balanceIndex,
  correctBalance,
  formatMoney,
  formatSignedMoney,
  merchantName,
  parseBalanceInput,
  planCheckIn,
  planWalletDelete,
  planWalletEdit,
  transactionRow,
  waitingLine,
  walletColour,
  WALLET_TYPES,
  type FinanceWallet,
} from '@repo/core';
import { moveDefaultWallet } from '@repo/data';
import { minorToNumber } from '@repo/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { SidePane } from '@/components/ledger/side-pane';
import { TxnRow } from '@/components/ledger/txn-row';
import { useQueryParams } from '@/components/ledger/use-query-param';
import { Page } from '@/components/shell/page';
import { commit, planContext } from '@/lib/ledger/commit';
import { rowDay } from '@/lib/ledger/format';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { useScreenKeys } from '@/lib/screen-keys';
import { BalanceCard } from './balance-card';
import { editWalletDraft, typeIcon, WalletForm, type WalletDraft } from './wallet-form';
import '@/components/ledger/ledger.css';
import '@/components/ledger/table-pane.css';
import './wallets.css';

const PAGE_SIZE = 25;

function Frame({ actions, children }: { actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Page title="Wallet" crumb={{ label: 'Wallets', href: '/home/wallets' }} phone="pushed" back="/home/wallets" actions={actions}>
      {children}
    </Page>
  );
}

/** A wallet's page (V2H-WalletDetail on the web): its balance and Edit amount, the chart, its transactions. */
export function WalletScreen({ id }: { id: string }) {
  const ledger = useLedger();
  const wallet = ledger.wallets.find((item) => item.id === id);
  if (!ledger.loaded) {
    return (
      <Frame>
        <div className="ledger" aria-busy="true">
          <div className="ledger-main">
            <div className="card skeleton" style={{ height: 160 }} />
            <div className="card skeleton" style={{ height: 300 }} />
          </div>
        </div>
      </Frame>
    );
  }
  if (!wallet) {
    return (
      <Frame>
        <section className="card empty wallet-gone">
          <span className="tile-empty-icon">
            <Glyph name="wallet-outline" size={22} />
          </span>
          <h2 className="empty-title">This wallet isn&apos;t here any more</h2>
          <p className="empty-line">It may have been deleted on another device.</p>
          <Link href="/home/wallets" className="btn btn-ink press">
            All wallets
          </Link>
        </section>
      </Frame>
    );
  }
  return <WalletLoaded ledger={ledger} wallet={wallet} />;
}

function WalletLoaded({ ledger, wallet }: { ledger: Ledger; wallet: FinanceWallet }) {
  const { balances, transactions, now, calendar, projection, userId, walletNames, aliases, currency } = ledger;
  const router = useRouter();
  const [params, setParams] = useQueryParams();
  const editing = params.get('edit') === 'wallet';
  const [draft, setDraft] = useState<WalletDraft>(() => editWalletDraft(wallet));
  const [amount, setAmount] = useState<string | null>(params.get('edit') === 'balance' ? '' : null);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const balanceMinor = balances[wallet.id] ?? 0;
  const own = useMemo(() => transactions.filter((transaction) => transaction.walletId === wallet.id || transaction.transferToWalletId === wallet.id), [transactions, wallet.id]);
  const index = useMemo(
    () => balanceIndex({ now, calendar, wallets: [{ id: wallet.id, balanceMinor: Number(balanceMinor), createdAt: wallet.createdAt }], transactions: own }),
    [now, calendar, wallet.id, wallet.createdAt, balanceMinor, own],
  );
  const pages = Math.max(1, Math.ceil(own.length / PAGE_SIZE));
  const shown = own.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const waiting = ledger.waiting.filter((proposal) => proposal.walletId === wallet.id && proposal.currency === wallet.currency);
  const typeLabel = WALLET_TYPES.find((option) => option.value === wallet.type)?.label ?? 'Wallet';
  const alertsFrom = wallet.notificationAppLabel ?? (wallet.notificationPackage ? 'your bank app' : null);
  const deleteCount = transactions.filter((transaction) => transaction.walletId === wallet.id).length;

  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (amount !== null) amountRef.current?.focus();
  }, [amount]);

  const saveAmount = () => {
    const typed = parseBalanceInput(amount ?? '');
    if (typed === null) return;
    const correction = correctBalance({ balance: minorToNumber(balanceMinor) }, typed);
    const saved = commit(
      planCheckIn(wallet.id, correction, projection, planContext(userId)),
      correction ? `Correction ${formatSignedMoney(correction.type, correction.amountMinor, wallet.currency)} added` : 'Balance checked',
    );
    if (saved) {
      setAmount(null);
      if (params.get('edit')) setParams({ edit: null });
    }
  };
  const startEdit = () => {
    setDraft(editWalletDraft(wallet));
    setParams({ edit: 'wallet' });
  };
  const saveEdit = () => {
    const colour = walletColour(draft.colourId);
    const saved = commit(
      planWalletEdit(wallet.id, { name: draft.name.trim(), type: draft.type, color: colour.hex, icon: typeIcon(draft.type), cardStyleId: colour.id }, projection, planContext(userId)),
      'Wallet saved',
    );
    if (saved) setParams({ edit: null });
  };
  const remove = () => {
    setConfirming(false);
    let cleared: Promise<boolean> | null = null;
    const done = commit(planWalletDelete(wallet.id, projection, planContext(userId)), `${wallet.name} deleted`, undefined, () => {
      void cleared?.then((was) => was && moveDefault(null, wallet.id));
    });
    if (!done) return;
    cleared = moveDefault(wallet.id, null);
    router.push('/home/wallets');
  };

  useScreenKeys((key) => {
    if (key !== 'Escape') return false;
    if (confirming) setConfirming(false);
    else if (editing) setParams({ edit: null });
    else if (amount !== null) setAmount(null);
    else return false;
    return true;
  });

  const actions = (
    <>
      <button type="button" className="btn btn-out press" onClick={startEdit}>
        <Glyph name="pencil-outline" size={18} />
        Edit wallet
      </button>
      <button type="button" className="btn btn-out press wallet-delete" onClick={() => setConfirming(true)}>
        <Glyph name="delete-outline" size={18} />
        Delete
      </button>
    </>
  );

  return (
    <Frame actions={actions}>
      <div className="ledger" data-screen="wallet">
        <div className="ledger-main">
          <section className="card wallet-hero" aria-label={wallet.name}>
            <div className="wallet-hero-top">
              <Bubble icon={wallet.icon ?? typeIcon(wallet.type)} color={wallet.color} size={52} glyph={24} />
              <span className="row-text">
                <h2 className="wallet-hero-name">{wallet.name}</h2>
                <span className="meta">
                  {typeLabel} · {wallet.currency}
                  {alertsFrom ? ` · alerts from ${alertsFrom}` : ''}
                </span>
              </span>
            </div>
            {amount === null ? (
              <div className="wallet-hero-balance">
                <span className="balance-total num" data-balance-minor={balanceMinor}>
                  {formatMoney(balanceMinor, wallet.currency)}
                </span>
                <button type="button" className="btn btn-sand press" onClick={() => setAmount('')}>
                  <Glyph name="pencil-outline" size={18} />
                  Edit amount
                </button>
              </div>
            ) : (
              <form
                className="wallet-amount"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveAmount();
                }}
              >
                <label className="wallet-input">
                  <span className="label-text">Balance now</span>
                  <input ref={amountRef} className="num" inputMode="decimal" value={amount} placeholder={minorToNumber(balanceMinor).toFixed(2)} onChange={(event) => setAmount(event.target.value)} />
                </label>
                <button type="button" className="btn btn-sand press" onClick={() => setAmount(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-ink press" disabled={parseBalanceInput(amount) === null}>
                  Save
                </button>
                <p className="meta wallet-note">
                  <Glyph name="information-outline" size={16} />
                  Moni adds a correction so your history still adds up.
                </p>
              </form>
            )}
          </section>
          {wallet.currency === currency && (
            <BalanceCard
              ledger={ledger}
              index={index}
              series={wallet.id}
              currency={wallet.currency}
              label={`${wallet.name} balance`}
              head={<span className="caps">Balance</span>}
            />
          )}
          {waiting.length > 0 && (
            <Link href="/review" className="card wallet-waiting press">
              <Bubble icon="tray-arrow-down" color={null} size={42} glyph={20} />
              <span className="row-text">
                <span className="row-title">
                  {waiting.length} {waiting.length === 1 ? 'capture' : 'captures'} to review
                </span>
                <span className="row-meta-text num">{waitingLine(waiting, wallet.id, wallet.currency)}</span>
              </span>
              <Glyph name="chevron-right" size={20} />
            </Link>
          )}
          <section className="card wallet-transactions" aria-label="Transactions">
            <div className="section-head">
              <h2 className="card-title">Transactions</h2>
              {own.length > 0 && (
                <Link href={`/activity?wallets=${wallet.id}`} className="see-all press" data-only="sidebar rail rail-one-column">
                  Open in Activity
                  <Glyph name="chevron-right" size={18} />
                </Link>
              )}
            </div>
            {own.length === 0 ? (
              <p className="meta wallet-none">Nothing in this wallet yet. Add spending with + or tell Moni.</p>
            ) : (
              <>
                <div className="wallet-txns">
                  {shown.map((transaction) => {
                    const row = transactionRow({ ...transaction, merchant: merchantName(transaction.merchant, aliases) }, { categoriesById: projection.categoriesById, walletNames });
                    const day = rowDay(row.date, now, calendar);
                    return <TxnRow key={row.id} row={row} href={`/activity/${row.id}`} meta={row.kind === 'transfer' ? `${day} · ${row.wallet} → ${row.toWallet}` : `${day} · ${row.category ?? 'No category'}`} />;
                  })}
                </div>
                {pages > 1 && (
                  <nav aria-label="Pages" className="pager wallet-pager">
                    <button type="button" className="pg press" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <Glyph name="chevron-left" size={20} />
                    </button>
                    {Array.from({ length: pages }, (_, number) => number + 1).map((number) => (
                      <button type="button" key={number} className="pg num press" aria-current={number === Math.min(page, pages) ? 'page' : undefined} onClick={() => setPage(number)}>
                        {number}
                      </button>
                    ))}
                    <button type="button" className="pg press" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                      <Glyph name="chevron-right" size={20} />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
        <SidePane label="Edit wallet" open={editing} onClose={() => setParams({ edit: null })}>
          {editing && <WalletForm editing draft={draft} onDraft={setDraft} onSave={saveEdit} onClose={() => setParams({ edit: null })} alertsFrom={alertsFrom} />}
        </SidePane>
      </div>
      {confirming && <ConfirmDeleteWallet name={wallet.name} count={deleteCount} onCancel={() => setConfirming(false)} onDelete={remove} />}
    </Frame>
  );
}

/** The default wallet follows a delete and its Undo. */
async function moveDefault(from: string | null, to: string | null): Promise<boolean> {
  const store = moniStore();
  const kept = await moveDefaultWallet(store.supabase, from, to).catch(() => null);
  if (kept) store.profilePreferences$.set(kept);
  return kept !== null;
}

function ConfirmDeleteWallet({ name, count, onCancel, onDelete }: { name: string; count: number; onCancel: () => void; onDelete: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="scrim scrim-center" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-wallet-title" className="dialog confirm-dialog motion-pop">
        <h2 id="delete-wallet-title" className="dialog-title">
          Delete {name}?
        </h2>
        <p className="confirm-line">{count === 0 ? 'It has no transactions.' : `Its ${count} ${count === 1 ? 'transaction goes' : 'transactions go'} too, and your totals change.`}</p>
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="btn btn-sand press" onClick={onCancel}>
            Keep it
            <span className="kbd">Esc</span>
          </button>
          <button type="button" className="btn confirm-danger press" onClick={onDelete}>
            <Glyph name="delete-outline" size={18} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
