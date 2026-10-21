import { minorToNumber, type CurrencyCode, type MinorAmount } from '@repo/types';

export const MINUS = '−';

const grouped = (digits: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const exact = grouped(2);
const whole = grouped(0);

function currencySymbol(currency: CurrencyCode | string): string {
  const code = String(currency).toUpperCase();
  if (code === 'MYR') return 'RM';
  try {
    const symbol = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;
    return symbol ?? `${code} `;
  } catch {
    return `${code} `;
  }
}

export function formatMoney(
  amountMinor: MinorAmount | number,
  currency: CurrencyCode | string,
): string {
  return `${currencySymbol(currency)}${exact.format(Math.abs(minorToNumber(amountMinor)))}`;
}

export function formatWholeMoney(
  amountMinor: MinorAmount | number,
  currency: CurrencyCode | string,
): string {
  return `${currencySymbol(currency)}${whole.format(Math.floor(Math.abs(minorToNumber(amountMinor))))}`;
}

export type MoneyDirection = 'expense' | 'income' | 'transfer';

export function formatSignedMoney(
  direction: MoneyDirection,
  amountMinor: MinorAmount | number,
  currency: CurrencyCode | string,
): string {
  const sign = direction === 'expense' ? MINUS : direction === 'income' ? '+' : '';
  return `${sign}${formatMoney(amountMinor, currency)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function relativeDay(date: Date, now: Date): 'Today' | 'Yesterday' | null {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : null;
}

export function formatDate(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const label = `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

export function formatDay(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return relativeDay(date, now) ?? formatDate(date, now);
}

export function formatDayHeading(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const relative = relativeDay(date, now);
  return relative ? `${relative} · ${formatDate(date, now)}` : formatDate(date, now);
}

export function localDayKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
