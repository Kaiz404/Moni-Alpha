import { useSyncExternalStore } from 'react';
import type { MinorAmount } from '@repo/types';

import type { WalletKind } from '@/constants/wallet-form';

/** A category tile with this month's spending in the sheet's currency. */
export type CategoryTile = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: MinorAmount;
  budgetMinor: MinorAmount | null;
};

export type WalletOption = {
  id: string;
  name: string;
  currency: string;
  type: string | null;
  icon: string | null;
  color: string | null;
  cardStyleId: string | null;
};

export type NotificationApp = { packageName: string; label: string };

/** The four rows of the + chooser. */
export type CaptureChoice = 'type' | 'scan' | 'say' | 'ask';

/** Each sheet kind: what the caller passes in, and what the sheet resolves to when the user picks. */
type Sheets = {
  category: {
    request: {
      title: string;
      currency: string;
      categories: CategoryTile[];
      selectedId: string | null;
      /** Shows the New category tile; the sheet closes before it runs. */
      onCreate?: () => void;
    };
    result: string;
  };
  wallet: {
    request: {
      title: string;
      wallets: WalletOption[];
      selectedId: string | null;
      emptyMessage?: string;
      /** Adds a first row that resolves to `walletId: null`. */
      noneLabel?: string;
    };
    result: { walletId: string | null };
  };
  currency: { request: { selected: string }; result: string };
  walletType: { request: { selected: WalletKind }; result: WalletKind };
  notificationApp: {
    request: { selected: string | null };
    result: { app: NotificationApp | null };
  };
  /** Dates are local `YYYY-MM-DD`. */
  date: { request: { selected: string }; result: string };
  chooser: { request: object; result: CaptureChoice };
  confirm: {
    request: {
      title: string;
      message?: string;
      confirmLabel: string;
      cancelLabel?: string;
      destructive?: boolean;
    };
    result: true;
  };
};

export type SheetKind = keyof Sheets;
export type SheetRequest = {
  [K in SheetKind]: { kind: K } & Sheets[K]['request'];
}[SheetKind];
export type SheetRequestOf<K extends SheetKind> = Extract<SheetRequest, { kind: K }>;
export type SheetResult<K extends SheetKind> = Sheets[K]['result'];

/** The one open sheet. `kind` sits at the top so narrowing it narrows `settle` too. */
export type OpenSheet = {
  [K in SheetKind]: {
    id: number;
    kind: K;
    request: SheetRequestOf<K>;
    settle: (result: SheetResult<K> | null) => void;
  };
}[SheetKind];

let current: OpenSheet | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function close(id: number) {
  if (current?.id !== id) return false;
  current = null;
  emit();
  return true;
}

/**
 * Opens a sheet and resolves with the user's pick, or `null` when the sheet
 * is dismissed or replaced by another `openSheet`.
 */
export function openSheet<R extends SheetRequest>(
  request: R,
): Promise<SheetResult<R['kind']> | null> {
  dismissSheet();
  const id = nextId++;
  return new Promise((resolve) => {
    current = {
      id,
      kind: request.kind,
      request,
      settle: (result: SheetResult<R['kind']> | null) => {
        if (close(id)) resolve(result);
      },
    } as OpenSheet;
    emit();
  });
}

export function dismissSheet() {
  current?.settle(null);
}

export function getOpenSheet() {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOpenSheet() {
  return useSyncExternalStore(subscribe, getOpenSheet, getOpenSheet);
}
