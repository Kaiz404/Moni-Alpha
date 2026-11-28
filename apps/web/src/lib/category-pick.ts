import { guessCategory, type CategoryClues, type FinanceCategory } from '@repo/core';
import type { Ledger } from './ledger/use-ledger';

type Pickable = Pick<Ledger, 'projection' | 'userId'>;

/** Every category the user sees, archived ones too. */
export function categoriesSeen(ledger: Pickable): FinanceCategory[] {
  return Object.values(ledger.projection.categoriesById).filter((category) => category.userId === null || category.userId === ledger.userId);
}

/** The categories a pick for this type offers, in the user's order. */
export function categoryChoices(ledger: Pickable, type: 'expense' | 'income'): FinanceCategory[] {
  return categoriesSeen(ledger)
    .filter((category) => category.isActive && (category.type === null || category.type === type))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

/** Up to three categories Moni guesses for a pick, best first, from `guessCategory` as the phone's sheet offers them. */
export function suggestedCategories(ledger: Pickable & Pick<Ledger, 'transactions'>, clues: CategoryClues): readonly string[] {
  return guessCategory(clues, ledger.transactions, categoriesSeen(ledger)).suggestions;
}
