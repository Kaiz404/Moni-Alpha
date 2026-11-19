'use client';

import { useSyncExternalStore } from 'react';
import { EMPTY_ADD_FORM, type AddForm, type AddMode } from '@/lib/add-entry';
import type { ChatMessage } from '@/lib/chat-thread';
import { moniStore } from '@/lib/moni-store';

/**
 * Shell state that must outlive any one view: the open overlay, the half-typed drafts, Moni chat's
 * thread and Activity's ticked rows (which Moni chat reads). Docked panes (Moni chat, Add) live in the
 * URL instead (`?pane=`), so a reload or a resize keeps them too.
 */
export type Overlay = 'none' | 'palette' | 'shortcuts' | 'account' | 'session';

export type ShellState = {
  overlay: Overlay;
  /** Add's step: the chooser, Type it or Ask Moni. */
  addMode: AddMode;
  /** Ask Moni's sentence. */
  addDraft: string;
  /** Type it's fields, typed or filled by Ask Moni. */
  addForm: AddForm;
  /** True while "Ask Moni uses AI" waits on the user before Ask Moni reads `addDraft`. */
  addAsk: boolean;
  chatDraft: string;
  chat: readonly ChatMessage[];
  /** The id of the question waiting on "Moni chat uses AI", or null. */
  chatAsk: string | null;
  ticked: readonly string[];
};

/**
 * W2-States' toast catalogue: done (a change with Undo, 4 s), undone (2 s, no button: an undo can't be
 * undone), error (stays until Try again or ×) and info (news, 4 s).
 */
export type ToastTone = 'done' | 'undone' | 'error' | 'info';

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  undo?: () => void;
  /** The Undone toast's words; "Undone." by default. */
  undoneText?: string;
  /** An error's Try again. */
  retry?: () => void;
};

const INITIAL: ShellState = {
  overlay: 'none',
  addMode: 'choose',
  addDraft: '',
  addForm: EMPTY_ADD_FORM,
  addAsk: false,
  chatDraft: '',
  chat: [],
  chatAsk: null,
  ticked: [],
};
let state: ShellState = INITIAL;
let toast: Toast | null = null;
/** The latest change Ctrl Z can take back, kept after its toast has gone. */
let lastUndo: Pick<Toast, 'undo' | 'undoneText'> | null = null;
let nextToastId = 1;
/** True once this tab chose to sign out, so its own sign-out never reads as an expired session. */
let signingOut = false;

export function isSigningOut(): boolean {
  return signingOut;
}
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
  signingOut = true;
  await moniStore().signOutEverywhere({
    beforeClear: () => {
      state = INITIAL;
      toast = null;
      lastUndo = null;
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
  if (next.undo) lastUndo = { undo: next.undo, undoneText: next.undoneText };
  emit();
  return toast.id;
}

export function dismissToast(id: number) {
  if (toast?.id !== id) return;
  toast = null;
  emit();
}

/**
 * Runs the latest change's Undo (the toast's button, or Ctrl Z even after the toast has gone), then says
 * Undone for 2 s. A change whose toast was dismissed by its own second control (a card's Undo) is gone.
 */
export function undoToast(): boolean {
  const latest = toast?.undo ? toast : lastUndo;
  if (!latest?.undo) return false;
  lastUndo = null;
  latest.undo();
  showToast({ text: latest.undoneText ?? 'Undone.', tone: 'undone' });
  return true;
}

/** Forgets the latest change's Undo, when something else already took it back. */
export function forgetUndo(undo: () => void) {
  if (lastUndo?.undo === undo) lastUndo = null;
}

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribe, () => toast, () => null);
}
