'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { parseThemePref, THEME_KEY, themeAttribute, type ThemePref } from '@/lib/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_KEY));
  } catch {
    return 'light';
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener('change', onChange);
  };
}

function snapshot(): string {
  return `${readPref()}:${window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'}`;
}

function apply(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Private windows may refuse storage; the theme still applies for this page.
  }
  const attribute = themeAttribute(pref);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;
  listeners.forEach((listener) => listener());
}

/**
 * The theme preference and the theme it resolves to. `setTheme` opens the new theme as a circle from
 * `origin` (W2-Motion 14) where the browser has view transitions, and fades it in under Reduce motion.
 */
export function useTheme() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'light:light');
  const [pref, system] = value.split(':') as [ThemePref, 'light' | 'dark'];
  const resolved: 'light' | 'dark' = pref === 'system' ? system : pref;

  const setTheme = useCallback((next: ThemePref, origin?: { x: number; y: number }) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition) return apply(next);
    const root = document.documentElement;
    root.dataset.themeSwitch = reduce || !origin ? 'fade' : 'circle';
    if (origin) {
      const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
      root.style.setProperty('--reveal-x', `${origin.x}px`);
      root.style.setProperty('--reveal-y', `${origin.y}px`);
      root.style.setProperty('--reveal-r', `${radius}px`);
    }
    const transition = document.startViewTransition(() => apply(next));
    void transition.finished.finally(() => delete root.dataset.themeSwitch);
  }, []);

  return { pref, resolved, setTheme };
}
