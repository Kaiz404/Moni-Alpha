import { minorToNumber, type MinorAmount } from '@repo/types';

const SYMBOLS: Record<string, string> = { MYR: 'RM' };
const MINUS = '−';

export function currencySymbol(currency: string): string {
  const code = currency.toUpperCase();
  const known = SYMBOLS[code];
  if (known) return known;
  try {
    const part = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * Glossary money: symbol with no space, thousands commas, U+2212 for
 * negatives. `whole` rounds toward zero for forward-looking numbers
 * ("RM100 left"); money that exists keeps two decimals ("RM96.50").
 */
export function formatMoney(
  amount: MinorAmount | number,
  currency: string,
  { whole = false }: { whole?: boolean } = {},
): string {
  const value = minorToNumber(amount);
  const magnitude = Math.abs(value);
  const digits = whole
    ? Math.floor(magnitude).toLocaleString('en-US')
    : magnitude.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  return `${value < 0 ? MINUS : ''}${currencySymbol(currency)}${digits}`;
}

export type MoneyDirection = 'expense' | 'income' | 'transfer';

/** A transaction amount: U+2212 for expenses, a plus for income, transfers unsigned. */
export function formatSignedMoney(
  direction: MoneyDirection,
  amount: MinorAmount | number,
  currency: string,
): string {
  const sign = direction === 'expense' ? MINUS : direction === 'income' ? '+' : '';
  return `${sign}${formatMoney(Math.abs(Number(amount)), currency)}`;
}
