import { z } from 'zod';

/** ISO 4217 code stored alongside every money value. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter ISO currency code');
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

/**
 * An integer number of the smallest supported currency unit (currently cents).
 * It deliberately has no decimal representation so application calculations do
 * not accumulate floating-point rounding errors.
 */
export type MinorAmount = number & {
  readonly __minorAmount: 'MinorAmount';
};

export const minorAmountSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((value) => value as MinorAmount);
export const positiveMinorAmountSchema = z
  .number()
  .int()
  .positive()
  .transform((value) => value as MinorAmount);

const MAX_MINOR_AMOUNT = 999_999_999_999;

function assertSafeMinor(value: number): MinorAmount {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MINOR_AMOUNT) {
    throw new Error('Amount is outside the supported DECIMAL(12,2) range');
  }
  return value as MinorAmount;
}

/** Parse a decimal DB/API value without doing finance arithmetic in floating point. */
export function decimalToMinor(value: string | number | null | undefined): MinorAmount {
  if (value === null || value === undefined || value === '') return 0 as MinorAmount;
  // String(number) preserves the supplied decimal representation. Do not use
  // toFixed here: it silently rounds values such as 1.005 before validation.
  const text = typeof value === 'number' ? String(value) : value.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Invalid decimal amount: ${String(value)}`);

  const sign = match[1] === '-' ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? '').padEnd(2, '0'));
  return assertSafeMinor(sign * (whole * 100 + fraction));
}

/** Serialize a minor-unit amount for Postgres NUMERIC(12,2) or external decimal wires. */
export function minorToDecimal(value: MinorAmount | number): string {
  const minor = assertSafeMinor(Number(value));
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/** Use only at a rendering/third-party chart boundary. */
export function minorToNumber(value: MinorAmount | number): number {
  return Number(value) / 100;
}

export function addMinor(...values: Array<MinorAmount | number>): MinorAmount {
  return assertSafeMinor(values.reduce((sum, value) => sum + Number(value), 0));
}

export function subtractMinor(
  left: MinorAmount | number,
  right: MinorAmount | number,
): MinorAmount {
  return assertSafeMinor(Number(left) - Number(right));
}

export function absoluteMinor(value: MinorAmount | number): MinorAmount {
  return assertSafeMinor(Math.abs(Number(value)));
}

export function formatMinorAmount(
  amount: MinorAmount | number,
  currency: CurrencyCode | string,
  options: Intl.NumberFormatOptions = {},
): string {
  const normalizedCurrency = String(currency).toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCodeSchema.parse(normalizedCurrency),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(minorToNumber(amount));
  } catch {
    return `${normalizedCurrency} ${minorToDecimal(amount)}`;
  }
}
