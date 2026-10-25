import { useSyncExternalStore } from 'react';

import type { IconSymbolName } from '@/components/ui/icon-symbol';

export const TOAST_MS = 5000;

export type ToastTone = 'done' | 'removed';

export type ToastRequest = {
  text: string;
  tone?: ToastTone;
  /** A cream glyph in place of the tone's, such as XA-Review's close for Not mine and clock for Later. */
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
