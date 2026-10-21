import { decimalToMinor, type MinorAmount } from '@repo/types';

import { currencySymbol } from '@/lib/finance/format-money';

export const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
] as const;

type Key = (typeof KEYPAD_ROWS)[number][number];

const MAX_WHOLE_DIGITS = 8;

/** What the amount reads after one key: two decimals at most, no leading zeros. */
export function typeKey(current: string, key: Key): string {
  if (key === 'back') return current.slice(0, -1);
  const [whole, fraction] = current.split('.');
  if (key === '.') return current.includes('.') ? current : `${current || '0'}.`;
  if (fraction !== undefined) return fraction.length >= 2 ? current : current + key;
  if (whole === '0') return key;
  return whole.length >= MAX_WHOLE_DIGITS ? current : current + key;
}

/** The typed text in minor units; a trailing point counts as nothing after it. */
export function typedMinor(text: string): MinorAmount {
  return decimalToMinor(text.replace(/\.$/, ''));
}

/** "RM1,250.5" while typing, "RM0" before the first key. */
export function typedDisplay(text: string, currency: string): string {
  const [whole, fraction] = text.split('.');
  const digits = Number(whole || '0').toLocaleString('en-US');
  return `${currencySymbol(currency)}${digits}${fraction === undefined ? '' : `.${fraction}`}`;
}
