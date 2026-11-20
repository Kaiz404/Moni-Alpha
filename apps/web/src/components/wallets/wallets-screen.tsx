'use client';

import { balanceIndex, currencyName, formatMoney, keptApartLine, planWalletCreate, walletColour, walletGroups, walletListMeta } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { SidePane } from '@/components/ledger/side-pane';
import { useQueryParams } from '@/components/ledger/use-query-param';
import { Page } from '@/components/shell/page';
import { commit, planContext } from '@/lib/ledger/commit';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { useScreenKeys } from '@/lib/screen-keys';
import { parseBalance } from '@/lib/setup';
import { assetsAndOwed, monthChanges, walletsCsv } from '@/lib/wallets-view';
import { BalanceCard } from './balance-card';
import { newWalletDraft, typeIcon, WalletForm, type WalletDraft } from './wallet-form';
import '@/components/ledger/ledger.css';
import '@/components/ledger/table-pane.css';
import './wallets.css';

function Frame({ actions, children }: { actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Page title="Wallets" crumb={{ label: 'Home', href: '/home' }} phone="pushed" back="/home" actions={actions}>
      {children}
    </Page>
  );
}

/** All wallets (V2H-Wallets on the web), pushed from Home's Wallets card. */
export function WalletsScreen() {
  const ledger = useLedger();
  if (!ledger.loaded) {
    return (
      <Frame>
        <div className="ledger" aria-busy="true">
          <div className="ledger-main">
            <div className="card skeleton" style={{ height: 300 }} />
            <div className="card skeleton" style={{ height: 240 }} />
          </div>
        </div>
      </Frame>
    );
  }
  return <WalletsLoaded ledger={ledger} />;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

function WalletsLoaded({ ledger }: { ledger: Ledger }) {
  const { wallets, balances, currency, transactions, now, calendar, userId } = ledger;
  const [params, setParams] = useQueryParams();
  const adding = params.get('new') === 'wallet';
  const [draft, setDraft] = useState<WalletDraft>(() => newWalletDraft(currency));
  const groups = useMemo(() => walletGroups(wallets, balances, currency), [wallets, balances, currency]);
  const main = groups.find((group) => group.main);
  const changes = useMemo(() => monthChanges(transactions, now, calendar), [transactions, now, calendar]);
  const linked = useMemo(() => new Set(wallets.filter((wallet) => wallet.notificationPackage).map((wallet) => wallet.id)), [wallets]);
  const index = useMemo(
    () =>
      balanceIndex({
        now,
        calendar,
        wallets: (main?.wallets ?? []).map((wallet) => ({ id: wallet.id, balanceMinor: Number(balances[wallet.id] ?? 0), createdAt: wallet.createdAt })),
        transactions: transactions.filter((transaction) => transaction.currency === currency),
      }),
    [main, balances, transactions, now, calendar, currency],
  );
  const { assetsMinor, owedMinor } = assetsAndOwed(main, balances);

  const startNew = () => {
    setDraft(newWalletDraft(currency));
    setParams({ new: 'wallet' });
  };
  const save = () => {
    const colour = walletColour(draft.colourId);
    const created = commit(
      planWalletCreate(
        {
          name: draft.name.trim(),
          type: draft.type,
          currency: draft.currency,
          initialBalanceMinor: parseBalance(draft.balance) ?? (0 as MinorAmount),
          color: colour.hex,
          icon: typeIcon(draft.type),
          cardStyleId: colour.id,
        },
        planContext(userId),
      ),
      `${draft.name.trim()} added`,
    );
    if (created) setParams({ new: null });
  };

  useScreenKeys((key) => {
    if (key === 'Escape' && adding) {
      setParams({ new: null });
      return true;
    }
    return false;
  });

  const actions = (
    <>
      <button type="button" className="btn btn-out press" data-only="sidebar rail rail-one-column" onClick={() => download('moni-wallets.csv', walletsCsv(groups, balances, changes, linked))}>
        <Glyph name="tray-arrow-down" size={18} />
        Download CSV
      </button>
      <button type="button" className="btn btn-ink press" onClick={startNew}>
        <Glyph name="plus" size={18} />
        New wallet
      </button>
    </>
  );

  return (
    <Frame actions={actions}>
      <div className="ledger" data-screen="wallets">
        <div className="ledger-main">
          <BalanceCard
            ledger={ledger}
            index={index}
            series="total"
            currency={currency}
            label="Net worth"
            head={
              <div className="balance-titles">
                <span className="caps">Net worth</span>
                <span className="balance-total num" data-net-worth={main?.totalMinor ?? 0}>
                  {formatMoney(main?.totalMinor ?? 0, currency)}
                </span>
                {owedMinor > 0 && (
                  <span className="meta num balance-split" data-only="sidebar rail rail-one-column">
                    {formatMoney(assetsMinor, currency)} in your wallets, {formatMoney(owedMinor, currency)} owed on cards
                  </span>
                )}
              </div>
            }
          />
          {groups.map((group) => {
            const { name } = currencyName(group.currency);
            return (
              <section key={group.currency} className="card wallet-group" aria-label={name}>
                <div className="wallet-group-head">
                  <span className="caps">{group.main ? `${name} · main currency` : name}</span>
                  <span className="num wallet-group-total">{formatMoney(group.totalMinor, group.currency)}</span>
                </div>
                <div className="wallet-cols" data-only="sidebar rail rail-one-column" aria-hidden="true">
                  <span>Wallet</span>
                  <span>This month</span>
                  <span>Balance</span>
                </div>
                <ul className="wallet-lines">
                  {group.wallets.map((wallet) => {
                    const change = changes[wallet.id] ?? 0;
                    return (
                      <li key={wallet.id}>
                        <Link href={`/home/wallets/${wallet.id}`} className="wallet-line press" data-wallet={wallet.id}>
                          <Bubble icon={wallet.icon ?? typeIcon(wallet.type)} color={wallet.color} size={42} glyph={20} />
                          <span className="row-text">
                            <span className="row-title">{wallet.name}</span>
                            <span className="row-meta-text">{walletListMeta(wallet, group.main, linked.has(wallet.id))}</span>
                          </span>
                          <span className="num wallet-change" data-only="sidebar rail rail-one-column" data-tone={change > 0 ? 'good' : undefined}>
                            {change === 0 ? '–' : `${change > 0 ? '+' : ''}${formatMoney(change, wallet.currency)}`}
                          </span>
                          <span className="num wallet-line-balance">{formatMoney(balances[wallet.id] ?? 0, wallet.currency)}</span>
                          <Glyph name="chevron-right" size={20} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {!group.main && (
                  <p className="meta kept-apart">
                    <Glyph name="information-outline" size={16} />
                    {keptApartLine(group.currency, currency)}
                  </p>
                )}
              </section>
            );
          })}
          <button type="button" className="add-wallet press" onClick={startNew}>
            <span className="add-wallet-plus">
              <Glyph name="plus" size={20} />
            </span>
            <span className="row-text">
              <span className="row-title">Add a wallet</span>
              <span className="row-meta-text">Bank, cash, e-wallet or card</span>
            </span>
            <Glyph name="chevron-right" size={20} />
          </button>
        </div>
        <SidePane name="wallet" label="New wallet" open={adding} onClose={() => setParams({ new: null })}>
          {adding && <WalletForm editing={false} draft={draft} onDraft={setDraft} onSave={save} onClose={() => setParams({ new: null })} />}
        </SidePane>
      </div>
    </Frame>
  );
}
