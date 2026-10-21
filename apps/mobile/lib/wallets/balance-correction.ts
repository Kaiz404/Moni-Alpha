import {
  absoluteMinor,
  decimalToMinor,
  minorToNumber,
  subtractMinor,
  type MinorAmount,
} from '@repo/types';

export const BALANCE_CORRECTION_TITLE = 'Balance correction';

/** The ledger row that moves a wallet from the balance Moni has to the one the user typed. */
export type BalanceCorrection = {
  type: 'income' | 'expense';
  amountMinor: MinorAmount;
  description: typeof BALANCE_CORRECTION_TITLE;
  categoryId: null;
  merchant: null;
  analysisExcluded: true;
  metadata: { kind: 'balance_correction' };
};

/** Balances are decimals in the wallet's currency, as the user reads them. `null` when nothing changes. */
export function correctBalance(
  wallet: { balance: number },
  newBalance: number,
): BalanceCorrection | null {
  const difference = subtractMinor(decimalToMinor(newBalance), decimalToMinor(wallet.balance));
  if (difference === 0) return null;
  return {
    type: difference > 0 ? 'income' : 'expense',
    amountMinor: absoluteMinor(difference),
    description: BALANCE_CORRECTION_TITLE,
    categoryId: null,
    merchant: null,
    analysisExcluded: true,
    metadata: { kind: 'balance_correction' },
  };
}

/** The typed balance as a decimal, or `null` while it is not a 2-decimal amount. Accepts commas and U+2212. */
export function parseBalanceInput(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '').replace('−', '-');
  if (!cleaned) return null;
  try {
    return minorToNumber(decimalToMinor(cleaned));
  } catch {
    return null;
  }
}
