import { resolveCurrencyOption } from '@/constants/currencies';

const SAME_IN_PLURAL = new Set([
  'ringgit',
  'yen',
  'won',
  'baht',
  'dong',
  'rupiah',
  'yuan',
  'rand',
]);

/** Sentence case, as V2H-Profile writes it: "Malaysian ringgit", "US dollar". */
export function currencyName(code: string): string {
  const words = resolveCurrencyOption(code).name.split(' ');
  if (words.length < 2) return words.join(' ');
  const unit = words.pop() as string;
  return [...words, unit.toLowerCase()].join(' ');
}

/** What a wallet is "in" on the Profile Wallets row: "ringgit", "US dollars". */
export function currencyHeldIn(code: string): string {
  if (code.toUpperCase() === 'MYR') return 'ringgit';
  const name = currencyName(code);
  if (name === code.toUpperCase()) return name;
  const unit = name.split(' ').pop() as string;
  return SAME_IN_PLURAL.has(unit.toLowerCase()) ? name : `${name}s`;
}
