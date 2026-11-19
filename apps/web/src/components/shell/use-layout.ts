'use client';

import { useSyncExternalStore } from 'react';
import { FOLDS_TO, LAYOUT_KINDS, LAYOUT_QUERIES, NAV_FOLDED_ATTR, NAV_FOLDED_KEY, PANE_COVERS_QUERY, type LayoutKind } from '@/lib/layout';

const LAYOUT_EVENT = 'moni-layout';

function subscribe(onChange: () => void) {
  const lists = LAYOUT_KINDS.map((kind) => window.matchMedia(LAYOUT_QUERIES[kind]));
  lists.forEach((list) => list.addEventListener('change', onChange));
  window.addEventListener(LAYOUT_EVENT, onChange);
  return () => {
    lists.forEach((list) => list.removeEventListener('change', onChange));
    window.removeEventListener(LAYOUT_EVENT, onChange);
  };
}

function folded(): boolean {
  return document.documentElement.hasAttribute(NAV_FOLDED_ATTR);
}

function current(): LayoutKind {
  const kind = LAYOUT_KINDS.find((each) => window.matchMedia(LAYOUT_QUERIES[each]).matches) ?? 'sidebar';
  return folded() ? (FOLDS_TO[kind] ?? kind) : kind;
}

/** The layout the viewport and the fold pick right now. The server renders every layout's parts and CSS shows one. */
export function useLayout(): LayoutKind | null {
  return useSyncExternalStore(subscribe, current, () => null);
}

/**
 * Folds the sidebar to the rail or opens it again, remembered in this browser. The sidebar and the
 * rail morph into each other as one view-transition group, and the page slides with them; under
 * Reduce motion, or without view transitions, it swaps at once.
 */
export function setNavFolded(next: boolean) {
  const apply = () => {
    const root = document.documentElement;
    if (next) root.setAttribute(NAV_FOLDED_ATTR, '');
    else root.removeAttribute(NAV_FOLDED_ATTR);
    try {
      localStorage.setItem(NAV_FOLDED_KEY, next ? '1' : '0');
    } catch {
      // Private windows may refuse storage; the fold still holds for this page.
    }
    window.dispatchEvent(new Event(LAYOUT_EVENT));
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !document.startViewTransition) return apply();
  const root = document.documentElement;
  root.dataset.navSwap = '';
  const transition = document.startViewTransition(apply);
  void transition.finished.finally(() => delete root.dataset.navSwap);
}

function subscribeCovers(onChange: () => void) {
  const list = window.matchMedia(PANE_COVERS_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/** Whether a docked pane covers the page at this viewport, so what it shows is edited in the pane. */
export function usePaneCovers(): boolean {
  return useSyncExternalStore(subscribeCovers, () => window.matchMedia(PANE_COVERS_QUERY).matches, () => false);
}
