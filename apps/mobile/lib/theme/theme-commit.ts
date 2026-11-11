import { useLayoutEffect, useRef } from 'react';

let requestedAt: number | null = null;
const waiters = new Set<() => void>();

/**
 * Resolves when the root commits the next theme, or after `timeoutMs`: `system` can resolve to the
 * theme already showing, and then no commit comes.
 */
export function nextThemeCommit(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      waiters.delete(done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    waiters.add(done);
  });
}

/** Starts the dev clock for one theme switch; `useThemeCommit` reads it when the new theme lands. */
export function markThemeRequested(): void {
  if (__DEV__) requestedAt = performance.now();
}

/**
 * Called by the root layout with the resolved theme. It answers `nextThemeCommit`, and in
 * development logs how long a switch took to commit and to reach the next frame, so a slow
 * recolour shows up as a number, not a feeling.
 */
export function useThemeCommit(theme: string): void {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    for (const done of [...waiters]) done();
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
