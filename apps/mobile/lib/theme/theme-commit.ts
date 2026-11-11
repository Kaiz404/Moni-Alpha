import { useLayoutEffect, useRef } from 'react';

let requestedAt: number | null = null;

/** Starts the dev clock for one theme switch; `useThemeCommit` reads it when the new theme lands. */
export function markThemeRequested(): void {
  if (__DEV__) requestedAt = performance.now();
}

/**
 * Called by the root layout with the resolved theme. In development it logs how long a switch took
 * to commit and to reach the next frame, so a slow recolour shows up as a number, not a feeling.
 */
export function useThemeCommit(theme: string): void {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!__DEV__ || requestedAt === null) return;
    const start = requestedAt;
    requestedAt = null;
    const committed = performance.now() - start;
    requestAnimationFrame(() => {
      console.log(
        `[theme] ${theme}: commit ${committed.toFixed(0)} ms, next frame ${(performance.now() - start).toFixed(0)} ms`,
      );
    });
  }, [theme]);
}
