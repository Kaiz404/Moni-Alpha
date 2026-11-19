import type { MinorAmount } from '@repo/types';

import { formatMoney } from '../glossary';
import { walletEffect } from '../ledger';

import type { FinanceProposal, FinanceWallet } from './types';

/** The pastel a wallet's 42 list bubble takes. */
export type WalletTint = 'sand' | 'mint' | 'lemon' | 'lilac' | 'peach' | 'coral' | 'sky' | 'aqua';

/** The wallet types the form offers, each with its MDI glyph. */
export const WALLET_TYPES = [
  { value: 'bank', label: 'Bank', icon: 'bank' },
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'credit', label: 'Credit', icon: 'credit-card' },
  { value: 'debit', label: 'Debit', icon: 'credit-card-outline' },
  { value: 'ewallet', label: 'Digital wallet', icon: 'wallet' },
  { value: 'investment', label: 'Investment', icon: 'trending-up' },
] as const;

/**
 * The colours a wallet can take. `id` is stored on `wallets.card_style_id` and `hex` on `wallets.color`;
 * never rename an id, only append.
 */
export const WALLET_COLOURS = [
  { id: 'emerald-grain', label: 'Mint', hex: '#57D374', tint: 'mint' },
  { id: 'citrus-pop', label: 'Lemon', hex: '#F9D51F', tint: 'lemon' },
  { id: 'coral-bloom', label: 'Coral', hex: '#FA402D', tint: 'coral' },
  { id: 'ocean-deep', label: 'Aqua', hex: '#3EDBCA', tint: 'aqua' },
  { id: 'violet-dusk', label: 'Lilac', hex: '#8C5CF3', tint: 'lilac' },
  { id: 'midnight-mint', label: 'Mint shade', hex: '#236B47', tint: 'mint' },
  { id: 'rose-quartz', label: 'Peach', hex: '#FA8A48', tint: 'peach' },
  { id: 'slate-steel', label: 'Neutral', hex: '#7B8179', tint: 'sand' },
] as const satisfies readonly { id: string; label: string; hex: string; tint: WalletTint }[];

export type WalletColour = (typeof WALLET_COLOURS)[number];

export function walletColour(id: string): WalletColour {
  return WALLET_COLOURS.find((colour) => colour.id === id)!;
}

const CURRENCY_NAMES: Record<string, { name: string; plural: string }> = {
  MYR: { name: 'Ringgit', plural: 'ringgit' },
  USD: { name: 'US dollar', plural: 'dollars' },
  SGD: { name: 'Singapore dollar', plural: 'Singapore dollars' },
  EUR: { name: 'Euro', plural: 'euros' },
  GBP: { name: 'British pound', plural: 'pounds' },
  AUD: { name: 'Australian dollar', plural: 'Australian dollars' },
  JPY: { name: 'Japanese yen', plural: 'yen' },
  IDR: { name: 'Indonesian rupiah', plural: 'rupiah' },
  THB: { name: 'Thai baht', plural: 'baht' },
  CNY: { name: 'Chinese yuan', plural: 'yuan' },
};

/** "Ringgit" for a section heading, "ringgit" inside a sentence; an unknown code reads as itself. */
export function currencyName(code: string): { name: string; plural: string } {
  return CURRENCY_NAMES[code] ?? { name: code, plural: code };
}

const LIST_TYPE: Record<string, string> = {
  bank: 'Bank',
  cash: 'Cash',
  credit: 'Card',
  debit: 'Card',
  ewallet: 'E-wallet',
  investment: 'Investment',
  other: 'Wallet',
};

/** The line under a wallet's name on All wallets: its type, and whether bank alerts reach it. */
export function walletListMeta(wallet: Pick<FinanceWallet, 'type' | 'currency'>, main: boolean, alertsOn: boolean): string {
  const type = LIST_TYPE[wallet.type] ?? 'Wallet';
  if (!main) return `${type}, ${currencyName(wallet.currency).plural}`;
  if (wallet.type === 'cash' && !alertsOn) return 'In your pocket';
  return alertsOn ? `${type}, alerts on` : type;
}

export type WalletGroup = { currency: string; main: boolean; wallets: FinanceWallet[]; totalMinor: number };

/** All wallets' sections: the main currency first, then each other currency by code, each with its total. */
export function walletGroups(
  wallets: readonly FinanceWallet[],
  balances: Readonly<Record<string, MinorAmount>>,
  mainCurrency: string,
): WalletGroup[] {
  const byCurrency = new Map<string, FinanceWallet[]>();
  for (const wallet of wallets) byCurrency.set(wallet.currency, [...(byCurrency.get(wallet.currency) ?? []), wallet]);
  return [...byCurrency.entries()]
    .map(([currency, members]) => ({
      currency,
      main: currency === mainCurrency,
      wallets: members,
      totalMinor: members.reduce((sum, wallet) => sum + Number(balances[wallet.id] ?? 0), 0),
    }))
    .sort((a, b) => (a.main ? -1 : b.main ? 1 : a.currency.localeCompare(b.currency)));
}

/** The note under another currency's section. */
export function keptApartLine(currency: string, mainCurrency: string): string {
  return `Kept apart. Moni never converts ${currencyName(currency).plural} or adds them to your ${currencyName(mainCurrency).plural}.`;
}

/** What a wallet's waiting captures would do to its balance once approved; a capture with no type yet moves nothing. */
export function waitingLine(
  proposals: readonly Pick<FinanceProposal, 'type' | 'walletId' | 'transferToWalletId' | 'amountMinor'>[],
  walletId: string,
  currency: string,
): string {
  let net = 0;
  for (const proposal of proposals) {
    if (!proposal.type || !proposal.walletId || proposal.amountMinor === null) continue;
    net += Number(walletEffect({ type: proposal.type, walletId: proposal.walletId, transferToWalletId: proposal.transferToWalletId, amountMinor: proposal.amountMinor }, walletId));
  }
  if (net < 0) return `${formatMoney(-net, currency)} comes off this balance after review`;
  if (net > 0) return `${formatMoney(net, currency)} goes on this balance after review`;
  return "Not in this balance yet";
}
