'use client';

import { WALLET_COLOURS, WALLET_TYPES, walletColour, type FinanceWallet } from '@repo/core';
import type { WalletType } from '@repo/types';
import { useMemo } from 'react';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { currencyChoices, parseBalance } from '@/lib/setup';

/** New wallet or Edit wallet as typed; it lives with the screen so a resize keeps it. */
export type WalletDraft = { name: string; type: WalletType; currency: string; balance: string; colourId: string };

export function newWalletDraft(currency: string): WalletDraft {
  return { name: '', type: 'bank', currency, balance: '', colourId: WALLET_COLOURS[1].id };
}

export function editWalletDraft(wallet: FinanceWallet): WalletDraft {
  const known = WALLET_COLOURS.some((colour) => colour.id === wallet.cardStyleId);
  return {
    name: wallet.name,
    type: (WALLET_TYPES.some((type) => type.value === wallet.type) ? wallet.type : 'bank') as WalletType,
    currency: wallet.currency,
    balance: '',
    colourId: known ? wallet.cardStyleId! : WALLET_COLOURS[0].id,
  };
}

/** The wallet's glyph for its type. */
export function typeIcon(type: string): string {
  return WALLET_TYPES.find((option) => option.value === type)?.icon ?? 'wallet';
}

/**
 * V2H-WalletForm in the docked pane: name, type, currency (locked once made), starting balance on a new
 * wallet, and colour. Edit wallet shows which banking app's alerts land here; linking one happens on the phone.
 */
export function WalletForm({
  editing,
  draft,
  onDraft,
  onSave,
  onClose,
  alertsFrom,
}: {
  editing: boolean;
  draft: WalletDraft;
  onDraft: (draft: WalletDraft) => void;
  onSave: () => void;
  onClose: () => void;
  /** Edit wallet: the banking app linked to it, if any. */
  alertsFrom?: string | null;
}) {
  const set = (patch: Partial<WalletDraft>) => onDraft({ ...draft, ...patch });
  const choices = useMemo(() => {
    const codes = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : ['MYR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD'];
    return currencyChoices(codes);
  }, []);
  const name = draft.name.trim();
  const balanceOk = editing || parseBalance(draft.balance) !== null;
  const ready = Boolean(name) && balanceOk;
  const colour = walletColour(draft.colourId);
  const typeLabel = WALLET_TYPES.find((option) => option.value === draft.type)?.label ?? 'Wallet';
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      if (ready) onSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="detail-body wallet-form" role="form" aria-label={editing ? 'Edit wallet' : 'New wallet'} onKeyDown={keys}>
      <div className="detail-top">
        <button type="button" className="round-btn small phone-back" aria-label="Back" onClick={onClose}>
          <Glyph name="chevron-left" />
        </button>
        <h2 className="detail-name" style={{ flex: '1 1 auto', fontSize: 22 }}>
          {editing ? 'Edit wallet' : 'New wallet'}
        </h2>
        <button type="button" className="round-btn small desk-nav" onClick={onClose} aria-label="Close (Esc)">
          <Glyph name="close" />
        </button>
      </div>
      <div className="wallet-preview">
        <Bubble icon={typeIcon(draft.type)} color={colour.hex} size={52} glyph={24} />
        <span className="row-text">
          <b data-empty={!name || undefined}>{name || 'New wallet'}</b>
          <span className="meta">
            {typeLabel} · {draft.currency}
            {alertsFrom ? ` · alerts from ${alertsFrom}` : ''}
          </span>
        </span>
      </div>
      <label className="wallet-input">
        <span className="label-text">Name</span>
        <input value={draft.name} placeholder="e.g. Everyday bank" maxLength={100} autoFocus onChange={(event) => set({ name: event.target.value })} />
      </label>
      <div className="wallet-pair">
        <label className="wallet-input wallet-select">
          <span className="label-text">Type</span>
          <select value={draft.type} onChange={(event) => set({ type: event.target.value as WalletType })}>
            {WALLET_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Glyph name="chevron-down" size={18} />
        </label>
        {editing ? (
          <span className="wallet-input wallet-locked" aria-label={`Currency, ${draft.currency}. A wallet keeps its currency.`}>
            <span className="label-text">Currency</span>
            <b>{draft.currency}</b>
            <Glyph name="lock-outline" size={16} />
          </span>
        ) : (
          <label className="wallet-input wallet-select">
            <span className="label-text">Currency</span>
            <select value={draft.currency} onChange={(event) => set({ currency: event.target.value })}>
              {(choices.some((choice) => choice.code === draft.currency) ? choices : [{ code: draft.currency, name: draft.currency }, ...choices]).map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.code} {choice.name === choice.code ? '' : choice.name}
                </option>
              ))}
            </select>
            <Glyph name="chevron-down" size={18} />
          </label>
        )}
      </div>
      {!editing && (
        <label className="wallet-input" data-bad={!balanceOk || undefined}>
          <span className="label-text">Starting balance</span>
          <input className="num" inputMode="decimal" placeholder="0.00" value={draft.balance} aria-label={`Starting balance in ${draft.currency}`} onChange={(event) => set({ balance: event.target.value })} />
        </label>
      )}
      <div className="wallet-colours" role="radiogroup" aria-label="Colour">
        {WALLET_COLOURS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === draft.colourId}
            aria-label={option.label}
            className="wallet-swatch press"
            style={{ background: option.hex }}
            onClick={() => set({ colourId: option.id })}
          />
        ))}
      </div>
      {editing && (
        <>
          <p className="meta wallet-note">
            <Glyph name="bell-outline" size={16} />
            {alertsFrom ? `Alerts from ${alertsFrom} land here. Change the app on your phone.` : 'No bank alerts land here. Link a banking app on your phone.'}
          </p>
          <p className="meta wallet-note">
            <Glyph name="information-outline" size={16} />
            To fix the balance, use Edit amount on the wallet. Moni adds a correction so your history still adds up.
          </p>
        </>
      )}
      <span style={{ flex: '1 1 auto' }} />
      <button type="button" className="btn btn-ink press wallet-save" disabled={!ready} onClick={onSave}>
        {editing ? 'Save changes' : 'Create wallet'}
        <span className="kbd kbd-on-ink">Enter</span>
      </button>
    </div>
  );
}
