export {
  absoluteMinor,
  addMinor,
  currencyCodeSchema,
  decimalToMinor,
  formatMinorAmount,
  minorToDecimal,
  minorToNumber,
  PLAN_LIMIT_MINOR,
  subtractMinor,
  type CurrencyCode,
  type MinorAmount,
} from '@repo/types';

import { decimalToMinor, type MinorAmount } from '@repo/types';

/** Parse a text field exactly once at the UI boundary. */
export function parseAmountInput(value: string): MinorAmount {
  const cleaned = value.trim().replace(/,/g, '');
  const amount = decimalToMinor(cleaned);
  if (amount <= 0) throw new Error('Enter a positive amount.');
  return amount;
}
