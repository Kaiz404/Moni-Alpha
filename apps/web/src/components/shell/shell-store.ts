'use client';

import { useSyncExternalStore } from 'react';

/**
 * Shell state that must outlive any one view: the open overlay and the half-typed drafts. Docked panes
 * (Moni chat, Add) live in the URL instead (`?pane=`), so a reload or a resize keeps them too.
 */
export type Overlay = 'none' | 'palette' | 'shortcuts' | 'account';

export type ShellState = {
  overlay: Overlay;
  addDraft: string;
  chatDraft: string;
};

export type ToastTone = 'done' | 'error';

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  undo?: () => void;
};

let state: ShellState = { overlay: 'none', addDraft: '', chatDraft: '' };
let toast: Toast | null = null;
let nextToastId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setShell(patch: Partial<ShellState>) {
  state = { ...state, ...patch };
  emit();
}

export function useShell(): ShellState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** One toast at a time: a new one replaces the old (W2-Parts, Toasts and the tab). */
export function showToast(next: Omit<Toast, 'id'>) {
  toast = { ...next, id: nextToastId++ };
  emit();
}

export function dismissToast(id: number) {
  if (toast?.id !== id) return;
  toast = null;
  emit();
}

/** Runs the showing toast's Undo (its button, or Ctrl Z), then closes it. */
export function undoToast(): boolean {
  if (!toast?.undo) return false;
  const { undo, id } = toast;
  dismissToast(id);
  undo();
  return true;
}

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribe, () => toast, () => null);
}
