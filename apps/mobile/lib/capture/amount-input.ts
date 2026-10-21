import { decimalToMinor, type MinorAmount } from '@repo/types';

export type AmountKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'back';

/** The keypad in reading order, as V2A-CaptureType and V2P-AmountPage draw it. */
export const AMOUNT_KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '.',
  '0',
  'back',
] as const satisfies readonly AmountKey[];

const MAX_WHOLE_DIGITS = 9;
const MAX_DECIMALS = 2;

/**
 * Applies one key to what the user has typed so far: digits with at most one
 * point, nine digits before it and two after. A key that would break a limit
 * leaves the text unchanged.
 */
export function pressAmountKey(typed: string, key: AmountKey): string {
  if (key === 'back') return typed.slice(0, -1);
  const [whole, decimals] = typed.split('.');
  if (key === '.') {
    if (decimals !== undefined) return typed;
    return typed === '' ? '0.' : `${typed}.`;
  }
  if (decimals !== undefined) {
    return decimals.length < MAX_DECIMALS ? typed + key : typed;
  }
  if (whole === '0') return key;
  return whole.length < MAX_WHOLE_DIGITS ? typed + key : typed;
}

export type AmountReading = {
  /** Thousands commas, and the typed decimals as typed: `1,250.5`. Empty input reads `0`. */
  display: string;
  value: number;
  minor: MinorAmount;
};

export function readAmount(typed: string): AmountReading {
  const [whole, decimals] = typed.split('.');
  const grouped = Number(whole || '0').toLocaleString('en-US');
  return {
    display: decimals === undefined ? grouped : `${grouped}.${decimals}`,
    value: Number(typed || '0'),
    minor: decimalToMinor(typed || '0'),
  };
}
