import { currencySymbol, walletColour } from '@repo/core';
import { decimalToMinor, type CreateWallet, type MinorAmount } from '@repo/types';

/**
 * First-run set-up (W2-Onboarding): the main currency, Moni's AI, wallets and the phone app, then Home's
 * Get set up card. The words and rules the set-up pages and the card share.
 */

export type SetupStep = 1 | 2 | 3 | 4;

export type CurrencyChoice = { code: string; name: string; symbol: string };

/** Where a browser's region points when it names one: the currency a person there most likely spends. */
const REGION_CURRENCY: Record<string, string> = {
  MY: 'MYR', SG: 'SGD', ID: 'IDR', TH: 'THB', PH: 'PHP', VN: 'VND', BN: 'BND', IN: 'INR', PK: 'PKR', BD: 'BDT',
  LK: 'LKR', NP: 'NPR', CN: 'CNY', HK: 'HKD', TW: 'TWD', JP: 'JPY', KR: 'KRW', AU: 'AUD', NZ: 'NZD', US: 'USD',
  CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', GB: 'GBP', IE: 'EUR', FR: 'EUR',
  DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', PT: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY', IL: 'ILS', AE: 'AED',
  SA: 'SAR', QA: 'QAR', KW: 'KWD', OM: 'OMR', BH: 'BHD', EG: 'EGP', MA: 'MAD', NG: 'NGN', ZA: 'ZAR', KE: 'KES',
  GH: 'GHS', UG: 'UGX', TZ: 'TZS',
};

/** Time zones that name a region when the browser's language doesn't, as en-US does in Kuala Lumpur. */
const ZONE_REGION: Record<string, string> = {
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY', 'Asia/Singapore': 'SG', 'Asia/Jakarta': 'ID', 'Asia/Bangkok': 'TH',
  'Asia/Manila': 'PH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR', 'Asia/Hong_Kong': 'HK', 'Asia/Shanghai': 'CN', 'Australia/Sydney': 'AU', 'Europe/London': 'GB',
  'Asia/Dubai': 'AE', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
};

/** The currency the browser suggests, from its language's region or else its time zone; null when neither says. */
export function suggestedCurrency(locale: string, zone: string): string | null {
  const region = /[-_]([A-Z]{2})\b/.exec(locale)?.[1] ?? ZONE_REGION[zone];
  return (region && REGION_CURRENCY[region]) || null;
}

/** Every current currency the browser can name, by name. Old and fund codes the browser can't name drop out. */
export function currencyChoices(codes: readonly string[], locale = 'en'): CurrencyChoice[] {
  const names = new Intl.DisplayNames([locale], { type: 'currency', fallback: 'none' });
  return codes
    .flatMap((code) => {
      const name = names.of(code);
      return name && !/\(\d{4}/.test(name) && !/^X/.test(code) ? [{ code, name: sentenceCase(name), symbol: currencySymbol(code) }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "Malaysian Ringgit" as the glossary writes it: "Malaysian ringgit", the unit in lower case. */
function sentenceCase(name: string): string {
  return name.replace(/ ([A-Z])([a-z]+)$/, (_, first: string, rest: string) => ` ${first.toLowerCase()}${rest}`);
}

/** "Malaysian ringgit" for MYR, or the code when the browser can't name it. */
export function currencyName(code: string, locale = 'en'): string {
  return currencyChoices([code], locale)[0]?.name ?? code;
}

/**
 * Moni on the phone is in use: something arrived from a bank alert, a receipt or the voice, a capture
 * waits or was reviewed, or a wallet is linked to a banking app.
 */
export function usesPhoneApp(input: {
  sources: readonly string[];
  captures: number;
  linkedWallets: number;
}): boolean {
  return input.captures > 0 || input.linkedWallets > 0 || input.sources.some((source) => source === 'notification' || source === 'camera' || source === 'voice');
}

/** The search box: a code, a currency's name or a country's name, any letter case. */
export function searchCurrencies(choices: readonly CurrencyChoice[], query: string, locale = 'en'): CurrencyChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...choices];
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  const byCountry = new Set(
    Object.entries(REGION_CURRENCY)
      .filter(([region]) => regions.of(region)?.toLowerCase().includes(q))
      .map(([, code]) => code),
  );
  return choices.filter((choice) => choice.code.toLowerCase().includes(q) || choice.name.toLowerCase().includes(q) || byCountry.has(choice.code));
}

export type WalletKind = 'bank' | 'ewallet' | 'cash' | 'credit';

/** The four kinds set-up offers, each with the phone's icon and the card style its list bubble takes. */
export const WALLET_KINDS: Record<WalletKind, { label: string; icon: string; cardStyleId: string; color: string }> = {
  bank: { label: 'Bank', icon: 'bank', cardStyleId: 'citrus-pop', color: walletColour('citrus-pop').hex },
  ewallet: { label: 'E-wallet', icon: 'wallet', cardStyleId: 'violet-dusk', color: walletColour('violet-dusk').hex },
  cash: { label: 'Cash', icon: 'cash', cardStyleId: 'emerald-grain', color: walletColour('emerald-grain').hex },
  credit: { label: 'Card', icon: 'credit-card', cardStyleId: 'rose-quartz', color: walletColour('rose-quartz').hex },
};

export type WalletDraft = { key: string; name: string; kind: WalletKind; currency: string; balance: string };

/** The starting balance as typed: "2,281.80" or "RM 86.40"; empty is zero; anything else is null. */
export function parseBalance(text: string): MinorAmount | null {
  const plain = text.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!plain) return 0 as MinorAmount;
  if (!/^-?\d+(\.\d{0,2})?$/.test(plain)) return null;
  return decimalToMinor(plain);
}

/** Continue on the wallets step: at least one wallet has a name, and every named one's balance reads. */
export function walletsReady(drafts: readonly WalletDraft[]): boolean {
  const named = drafts.filter((draft) => draft.name.trim());
  return named.length > 0 && named.every((draft) => parseBalance(draft.balance) !== null);
}

/** The wallets to create, in the order they were typed; rows with no name are left out. */
export function walletsToCreate(drafts: readonly WalletDraft[]): CreateWallet[] {
  return drafts
    .filter((draft) => draft.name.trim())
    .map((draft) => {
      const kind = WALLET_KINDS[draft.kind];
      return {
        name: draft.name.trim(),
        type: draft.kind,
        currency: draft.currency,
        initialBalanceMinor: parseBalance(draft.balance) ?? (0 as MinorAmount),
        color: kind.color,
        icon: kind.icon,
        cardStyleId: kind.cardStyleId,
      };
    });
}

export type ChecklistKey = 'currency' | 'ai' | 'wallets' | 'budget' | 'phone';

export type ChecklistItem = { key: ChecklistKey; title: string; line: string; done: boolean };

/** Home's Get set up card: the four set-up steps, plus this month's budget. */
export function setupChecklist(input: {
  currency: string;
  currencyName: string;
  aiOn: boolean | null;
  wallets: number;
  monthName: string;
  budgetSet: boolean;
  phoneUsed: boolean;
}): ChecklistItem[] {
  return [
    { key: 'currency', title: 'Pick your main currency', line: `${input.currency} · ${input.currencyName}`, done: true },
    {
      key: 'ai',
      title: "Choose about Moni's AI",
      line: input.aiOn === null ? 'Moni asks before anything goes to AI' : `${input.aiOn ? 'On' : 'Off'} · change it in Settings`,
      done: input.aiOn !== null,
    },
    {
      key: 'wallets',
      title: 'Add your wallets',
      line: input.wallets === 1 ? '1 wallet' : input.wallets > 1 ? `${input.wallets} wallets` : 'Bank, cash, e-wallet or card',
      done: input.wallets > 0,
    },
    { key: 'budget', title: `Set ${input.monthName}'s budget`, line: 'This draws your spending chart', done: input.budgetSet },
    { key: 'phone', title: 'Get the phone app', line: 'For bank alerts and receipts', done: input.phoneUsed },
  ];
}

/**
 * The card shows from the end of set-up until every step is done or it is closed. Accounts that never
 * went through set-up never see it.
 */
export function showsChecklist(items: readonly ChecklistItem[], setup: { finishedAt?: string; hidden?: boolean }): boolean {
  return Boolean(setup.finishedAt) && !setup.hidden && items.some((item) => !item.done);
}

/** "Email me the link": the visitor's own mail app, addressed to them, with the Play link in it. */
export function phoneLinkMail(email: string, playLink: string): string {
  const body = `Get Moni on your Android phone: ${playLink}\n\nSign in with ${email} and everything it captures shows on the web too.`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Moni for your phone')}&body=${encodeURIComponent(body)}`;
}

const GET_APP_PAUSE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * W2-Responsive's Get the app banner: Android phones only (iPhone has no app yet), and not for 30 days
 * after it was closed.
 */
export function showsGetApp(userAgent: string, closedAt: number | null, now: number): boolean {
  return /Android/i.test(userAgent) && (closedAt === null || now - closedAt >= GET_APP_PAUSE_MS);
}
