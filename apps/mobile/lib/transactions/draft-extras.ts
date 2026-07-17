/**
 * Ephemeral, module-level draft for the optional fields collected on the
 * "More details" page of the quick-add transaction flow. Not persisted —
 * mirrors other local-only UI state in this app (e.g. theme preference is
 * MMKV-backed; this is even more transient and only needs to survive a
 * push/pop round trip within the same app session).
 */
export type TransactionDraftExtras = {
  merchant: string;
  description: string;
  locationSnapshot: {
    latitude: number;
    longitude: number;
    name: string | null;
  } | null;
};

const EMPTY: TransactionDraftExtras = {
  merchant: '',
  description: '',
  locationSnapshot: null,
};

let current: TransactionDraftExtras = { ...EMPTY };

export function getDraftExtras(): TransactionDraftExtras {
  return current;
}

export function setDraftExtras(extras: Partial<TransactionDraftExtras>): void {
  current = { ...current, ...extras };
}

export function resetDraftExtras(): void {
  current = { ...EMPTY };
}

export function hasDraftExtras(extras: TransactionDraftExtras): boolean {
  return Boolean(extras.merchant.trim() || extras.description.trim());
}
