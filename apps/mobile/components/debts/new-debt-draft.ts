import { useSyncExternalStore } from 'react';

import type { DebtSide } from '@/lib/finance/debt-summary';

/**
 * Record a debt's form, kept outside the page so the amount page it pushes can
 * read who and which way, and hand the amount back.
 */
export type NewDebtDraft = {
  name: string;
  direction: DebtSide;
  /** Keypad text, such as "25" or "12.5". */
  amount: string;
  walletId: string | null;
  dueDate: string | null;
  note: string;
};

const EMPTY: NewDebtDraft = {
  name: '',
  direction: 'owed_to_me',
  amount: '',
  walletId: null,
  dueDate: null,
  note: '',
};

let draft = EMPTY;
const listeners = new Set<() => void>();

export function editNewDebtDraft(patch: Partial<NewDebtDraft>): void {
  draft = { ...draft, ...patch };
  listeners.forEach((listener) => listener());
}

export function resetNewDebtDraft(): void {
  editNewDebtDraft(EMPTY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNewDebtDraft(): NewDebtDraft {
  return useSyncExternalStore(subscribe, () => draft);
}
