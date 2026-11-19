'use client';

import { useSyncExternalStore } from 'react';
import type { ChatMessage } from '@/lib/chat-thread';
import { moniStore } from '@/lib/moni-store';

/**
 * Shell state that must outlive any one view: the open overlay, the half-typed drafts, Moni chat's
 * thread and Activity's ticked rows (which Moni chat reads). Docked panes (Moni chat, Add) live in the
 * URL instead (`?pane=`), so a reload or a resize keeps them too.
 */
export type Overlay = 'none' | 'palette' | 'shortcuts' | 'account';

export type ShellState = {
  overlay: Overlay;
  addDraft: string;
  chatDraft: string;
  chat: readonly ChatMessage[];
  /** The id of the question waiting on "Moni chat uses AI", or null. */
  chatAsk: string | null;
  ticked: readonly string[];
};

export type ToastTone = 'done' | 'error';

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  undo?: () => void;
};

const INITIAL: ShellState = { overlay: 'none', addDraft: '', chatDraft: '', chat: [], chatAsk: null, ticked: [] };
let state: ShellState = INITIAL;
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

export function setShell(patch: Partial<ShellState> | ((current: ShellState) => Partial<ShellState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
}

export function getShell(): ShellState {
  return state;
}

/**
 * The one way out of an account, for Sign out and after Delete your account: drops the half-typed drafts,
 * the synced ledger and the session.
 */
export async function signOut(): Promise<void> {
  await moniStore().signOutEverywhere({
    beforeClear: () => {
      state = INITIAL;
      toast = null;
      emit();
    },
  });
}

export function useShell(): ShellState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** One toast at a time: a new one replaces the old (W2-Parts, Toasts and the tab). */
export function showToast(next: Omit<Toast, 'id'>): number {
  toast = { ...next, id: nextToastId++ };
  emit();
  return toast.id;
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
