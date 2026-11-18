'use client';

import { useSyncExternalStore } from 'react';
import { LAYOUT_KINDS, LAYOUT_QUERIES, type LayoutKind } from '@/lib/layout';

function subscribe(onChange: () => void) {
  const lists = LAYOUT_KINDS.map((kind) => window.matchMedia(LAYOUT_QUERIES[kind]));
  lists.forEach((list) => list.addEventListener('change', onChange));
  return () => lists.forEach((list) => list.removeEventListener('change', onChange));
}

function current(): LayoutKind {
  return LAYOUT_KINDS.find((kind) => window.matchMedia(LAYOUT_QUERIES[kind]).matches) ?? 'sidebar';
}

/** The layout the viewport picks right now. The server renders every layout's parts and CSS shows one. */
export function useLayout(): LayoutKind | null {
  return useSyncExternalStore(subscribe, current, () => null);
}
