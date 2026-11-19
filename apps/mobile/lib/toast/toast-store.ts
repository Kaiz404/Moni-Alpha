import { useSyncExternalStore } from 'react';

import type { IconSymbolName } from '@/components/ui/icon-symbol';

// Maestro takes longer than any Undo window to reach Undo, so a flow-run build passes a longer time.
const TEST_UNDO_MS = Number(process.env.EXPO_PUBLIC_E2E_TOAST_MS);

/** How long an Undo stays on screen: `ms`, or the flow-run build's longer time. */
export function undoWindowMs(ms: number): number {
  return TEST_UNDO_MS > 0 ? TEST_UNDO_MS : ms;
}

export const TOAST_MS = undoWindowMs(4000);

export type ToastTone = 'done' | 'removed';

export type ToastRequest = {
  text: string;
  tone?: ToastTone;
  /** A cream glyph in place of the tone's, such as XA-Review's close for Not mine. */
  icon?: IconSymbolName;
  undo?: () => void;
  commit?: () => void;
};

export type ShownToast = ToastRequest & { id: number; tone: ToastTone };

let current: ShownToast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: ShownToast | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

function settle(outcome: 'undo' | 'commit') {
  const leaving = current;
  if (!leaving) return;
  clearTimeout(timer);
  timer = undefined;
  publish(null);
  if (outcome === 'undo') leaving.undo?.();
  else leaving.commit?.();
}

export function showToast(request: ToastRequest): void {
  settle('commit');
  const toast: ShownToast = { ...request, tone: request.tone ?? 'done', id: nextId++ };
  publish(toast);
  timer = setTimeout(() => settle('commit'), TOAST_MS);
}

export function undoToast(): void {
  settle('undo');
}

export function dismissToast(): void {
  settle('commit');
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToast(): ShownToast | null {
  return useSyncExternalStore(subscribe, () => current);
}

const floors = new Set<{ height: number }>();
const floorListeners = new Set<() => void>();
let floor = 0;

/**
 * A pinned bar the toast must sit above while it shows, such as `PageActions`. Returns the release;
 * the toast rests on the tallest bar still held.
 */
export function holdToastFloor(height: number): () => void {
  const held = { height };
  const publishFloor = () => {
    floor = Math.max(0, ...[...floors].map((entry) => entry.height));
    floorListeners.forEach((listener) => listener());
  };
  floors.add(held);
  publishFloor();
  return () => {
    floors.delete(held);
    publishFloor();
  };
}

export function useToastFloor(): number {
  return useSyncExternalStore(
    (listener) => {
      floorListeners.add(listener);
      return () => {
        floorListeners.delete(listener);
      };
    },
    () => floor,
  );
}
