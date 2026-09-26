import { decimalToMinor, type MinorAmount } from '@repo/types';
import type { FactsTransaction, FactsWallet } from '../index';

export const BANK = 'bank-myr';
export const EWALLET = 'tng-myr';

export function wallet(over: Partial<FactsWallet> = {}): FactsWallet {
  return {
    id: BANK,
    type: 'bank',
    currency: 'MYR',
    initialBalanceMinor: decimalToMinor('3000'),
    isActive: true,
    balanceConfirmedAt: null,
    ...over,
  };
}

export function tx(
  date: Date,
  type: FactsTransaction['type'],
  amount: string | number,
  merchant: string | null,
  over: Partial<FactsTransaction> = {},
): FactsTransaction {
  return {
    walletId: BANK,
    transferToWalletId: null,
    amountMinor: (typeof amount === 'number' ? amount : decimalToMinor(amount)) as MinorAmount,
    currency: 'MYR',
    type,
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    merchant,
    transactionDate: date.toISOString(),
    ...over,
  };
}

/** Seeded LCG so the ledger is the same on every run. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Six months of a salaried MYR user: salary on the 25th (the Friday before on weekends), rent,
 * three bills, and noisy day-to-day spending (meals, irregular groceries, rides, shopping).
 */
export function salariedLedger(seed = 7): {
  wallets: FactsWallet[];
  transactions: FactsTransaction[];
} {
  const rand = random(seed);
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100);
  const transactions: FactsTransaction[] = [];
  let nextGrocery = new Date(2026, 3, 3).getTime();
  for (let d = new Date(2026, 3, 1); d <= new Date(2026, 9, 11); d.setDate(d.getDate() + 1)) {
    const at = (hour: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour);
    const day = d.getDate();
    if (day === 1) transactions.push(tx(at(8), 'expense', '1500', 'Landlord'));
    if (day === 10) transactions.push(tx(at(8), 'expense', '54.90', 'Netflix'));
    if (day === 15) transactions.push(tx(at(8), 'expense', '129', 'Unifi'));
    if (day === 20) transactions.push(tx(at(8), 'expense', '48', 'CelcomDigi'));
    const payday = new Date(d.getFullYear(), d.getMonth(), 25);
    while (payday.getDay() === 0 || payday.getDay() === 6) payday.setDate(payday.getDate() - 1);
    if (day === payday.getDate()) transactions.push(tx(at(7), 'income', '4500', 'Acme Sdn Bhd'));

    if (rand() < 0.85)
      transactions.push(
        tx(at(12), 'expense', between(8, 35), 'Mamak Corner', { walletId: EWALLET }),
      );
    if (rand() < 0.4)
      transactions.push(tx(at(19), 'expense', between(10, 45), 'Kopitiam', { walletId: EWALLET }));
    if (rand() < 0.3)
      transactions.push(tx(at(9), 'expense', between(10, 40), 'Grab', { walletId: EWALLET }));
    if (rand() < 0.08) transactions.push(tx(at(21), 'expense', between(50, 300), 'Shopee'));
    if (d.getTime() >= nextGrocery) {
      transactions.push(tx(at(18), 'expense', between(120, 260), 'Jaya Grocer'));
      nextGrocery = d.getTime() + Math.round(5 + rand() * 5) * 86_400_000;
    }
    if (day === 5)
      transactions.push(tx(at(10), 'transfer', '300', null, { transferToWalletId: EWALLET }));
  }
  return {
    wallets: [
      wallet({ initialBalanceMinor: decimalToMinor('5000') }),
      wallet({ id: EWALLET, type: 'ewallet', initialBalanceMinor: decimalToMinor('200') }),
    ],
    transactions,
  };
}
