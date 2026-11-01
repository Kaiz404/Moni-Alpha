import { curatedPackagesEquivalent } from '@/lib/notifications/notification-package-aliases';

export type MoneySide = 'bank' | 'ewallet';

/** One row per Malaysian bank or e-wallet. Adding a bank here is all pairing needs. */
export type Institution = {
  id: string;
  /** As the Review card and the Capture log say it. */
  name: string;
  kind: MoneySide;
  /** Android packages whose alerts come from it; legacy aliases resolve through the curated list. */
  packages: readonly string[];
  /** How alerts and wallet names write it, lowercase, one space between words. */
  names: readonly string[];
};

export const KNOWN_INSTITUTIONS: readonly Institution[] = [
  { id: 'maybank', name: 'Maybank', kind: 'bank', packages: ['com.maybank2u.life'], names: ['maybank', 'maybank2u', 'm2u', 'mae'] },
  { id: 'cimb', name: 'CIMB', kind: 'bank', packages: ['com.cimb.cimbocto'], names: ['cimb', 'cimb clicks', 'octo'] },
  { id: 'public-bank', name: 'Public Bank', kind: 'bank', packages: ['com.pbb.mypb'], names: ['public bank', 'pbe', 'mypb'] },
  { id: 'rhb', name: 'RHB', kind: 'bank', packages: ['com.rhbgroup.rhbmobilebanking'], names: ['rhb'] },
  { id: 'hong-leong', name: 'Hong Leong', kind: 'bank', packages: ['my.com.hongleongconnect.mobileconnect'], names: ['hong leong', 'hlb', 'hlbb'] },
  { id: 'ambank', name: 'AmBank', kind: 'bank', packages: ['com.ambank.ambankonline'], names: ['ambank', 'amonline'] },
  { id: 'bank-islam', name: 'Bank Islam', kind: 'bank', packages: ['com.bankislam.bimbmobile'], names: ['bank islam', 'bimb'] },
  { id: 'uob', name: 'UOB', kind: 'bank', packages: ['com.uob.mightymy'], names: ['uob'] },
  { id: 'hsbc', name: 'HSBC', kind: 'bank', packages: ['my.com.hsbc.hsbcmalaysia'], names: ['hsbc'] },
  { id: 'standard-chartered', name: 'Standard Chartered', kind: 'bank', packages: ['air.app.scb.breeze.android.main.my.prod'], names: ['standard chartered', 'scb'] },
  { id: 'ocbc', name: 'OCBC', kind: 'bank', packages: ['com.ocbc.mobile'], names: ['ocbc'] },
  { id: 'ryt', name: 'Ryt Bank', kind: 'bank', packages: ['my.rytbank.app'], names: ['ryt', 'ryt bank'] },
  { id: 'gxbank', name: 'GXBank', kind: 'bank', packages: ['my.com.gxbank.app'], names: ['gxbank', 'gx bank'] },
  { id: 'tng', name: "Touch 'n Go", kind: 'ewallet', packages: ['my.com.tngdigital.ewallet'], names: ['touch n go', 'touchngo', 'tng', 'tngd', 'tng digital'] },
  { id: 'grabpay', name: 'GrabPay', kind: 'ewallet', packages: ['com.grabtaxi.passenger'], names: ['grabpay', 'grab pay', 'grab'] },
  { id: 'boost', name: 'Boost', kind: 'ewallet', packages: ['my.com.myboost'], names: ['boost'] },
  { id: 'bigpay', name: 'BigPay', kind: 'ewallet', packages: ['me.bigpay.mobile'], names: ['bigpay', 'big pay'] },
  { id: 'shopeepay', name: 'ShopeePay', kind: 'ewallet', packages: ['com.shopee.my'], names: ['shopeepay', 'shopee pay'] },
];

/** The fields of a wallet that say which institution it is. */
export type InstitutionWallet = {
  id: string;
  name: string | null;
  type?: string | null;
  notificationPackage?: string | null;
};

function normalized(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

export function textNames(text: string | null | undefined, institution: Institution): boolean {
  if (!text) return false;
  const haystack = normalized(text);
  return institution.names.some((name) => haystack.includes(` ${name} `));
}

export function institutionNamedIn(
  text: string | null | undefined,
  kind: MoneySide,
  table: readonly Institution[] = KNOWN_INSTITUTIONS,
): Institution | null {
  return table.find((row) => row.kind === kind && textNames(text, row)) ?? null;
}

export function institutionById(
  id: string | null | undefined,
  table: readonly Institution[] = KNOWN_INSTITUTIONS,
): Institution | null {
  return table.find((row) => row.id === id) ?? null;
}

export function institutionOfWallet(
  wallet: InstitutionWallet,
  table: readonly Institution[] = KNOWN_INSTITUTIONS,
): Institution | null {
  const linked = wallet.notificationPackage;
  return (
    (linked && table.find((row) => row.packages.some((p) => curatedPackagesEquivalent(p, linked)))) ||
    table.find((row) => textNames(wallet.name, row)) ||
    null
  );
}

/** The wallet's own type says first; a wallet typed "other" still counts by its institution. */
export function moneySideOfWallet(
  wallet: InstitutionWallet,
  table: readonly Institution[] = KNOWN_INSTITUTIONS,
): MoneySide | null {
  if (wallet.type === 'ewallet') return 'ewallet';
  if (wallet.type === 'bank' || wallet.type === 'debit' || wallet.type === 'credit') return 'bank';
  if (wallet.type === 'cash' || wallet.type === 'investment') return null;
  return institutionOfWallet(wallet, table)?.kind ?? null;
}
