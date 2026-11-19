import {
  absoluteMinor,
  decimalToMinor,
  minorToNumber,
  subtractMinor,
  type MinorAmount,
} from '@repo/types';

import { planTransaction } from './transactions';
import { planned, refused, type LedgerView, type PlanContext, type Planned } from './types';

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

/** The correction as a ledger row dated now, analysis-excluded so it never counts as spending. */
export function planBalanceCorrection(
  walletId: string,
  correction: BalanceCorrection,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: PlanContext,
): Planned<{ id: string }> {
  return planTransaction({ ...correction, walletId, transactionDate: ctx.now }, 'manual', view, ctx);
}

/**
 * The check-in's answer: "That's right" (no correction) or "Fix it" with the typed balance. Either way
 * the wallet's balance counts as seen now.
 */
export function planCheckIn(
  walletId: string,
  correction: BalanceCorrection | null,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: PlanContext,
): Planned<{ id: string | null }> {
  if (!view.walletsById[walletId]) return refused('Wallet not found');
  const confirm = {
    table: 'wallets' as const,
    id: walletId,
    patch: { balance_confirmed_at: ctx.now, updated_at: ctx.now },
  };
  if (!correction) return planned({ patch: [confirm] }, { id: null });
  const row = planBalanceCorrection(walletId, correction, view, ctx);
  if (row.kind !== 'writes') return row;
  return planned({ insert: row.writes.insert, patch: [confirm] }, { id: row.result.id });
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
