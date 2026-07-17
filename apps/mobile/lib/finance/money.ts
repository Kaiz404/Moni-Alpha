export {
  absoluteMinor,
  addMinor,
  currencyCodeSchema,
  decimalToMinor,
  formatMinorAmount,
  minorToDecimal,
  minorToNumber,
  subtractMinor,
  type CurrencyCode,
  type MinorAmount,
} from '@repo/types';

import { decimalToMinor, type CurrencyCode, type MinorAmount } from '@repo/types';

/** Parse a text field exactly once at the UI boundary. */
export function parseAmountInput(value: string): MinorAmount {
  const cleaned = value.trim().replace(/,/g, '');
  const amount = decimalToMinor(cleaned);
  if (amount <= 0) throw new Error('Enter a positive amount.');
  return amount;
}

export function normalizeCurrency(value: unknown, fallback: CurrencyCode = 'USD'): CurrencyCode {
  const currency = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? (currency as CurrencyCode) : fallback;
}
