import { useSyncExternalStore } from 'react';

import { deleteTransaction } from '@/lib/supabase/transactions';
import { showToast } from '@/lib/toast/toast-store';

let hidden: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setHidden(next: ReadonlySet<string>) {
  hidden = next;
  listeners.forEach((listener) => listener());
}

function reveal(id: string) {
  const next = new Set(hidden);
  next.delete(id);
  setHidden(next);
}

/** Hides the row at once and soft-deletes it only when the "Deleted" toast leaves without Undo. */
export function deleteWithUndo(id: string, text: string): void {
  setHidden(new Set(hidden).add(id));
  showToast({
    text,
    tone: 'removed',
    undo: () => reveal(id),
    commit: () => {
      void deleteTransaction(id).finally(() => reveal(id));
    },
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHiddenTransactionIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => hidden);
}
