import { useSyncExternalStore } from 'react';
import { themeReveal } from 'moni-theme-reveal';
import { Uniwind } from 'uniwind';

import { setThemePreference, type ThemePreference } from '@/lib/theme/preference';
import { nextThemeCommit } from '@/lib/theme/theme-commit';

/** V2F-Motion: the new theme opens from the finger in 450, ease-in-out. */
export const REVEAL_MS = 450;
/** Longest wait for the new theme to commit before the circle opens anyway. */
const COMMIT_WAIT_MS = 500;

/** A point in window dp, as `measureInWindow` reports it. */
export type RevealOrigin = { x: number; y: number };

type ShownTheme = 'light' | 'dark';

/**
 * One reveal at a time. While the screenshot is being taken the latest pick waits in `wanted`;
 * once it is up, later picks recolour under it. `shown` is the theme on screen when it started,
 * which the status bar keeps until the circle has opened.
 */
type RevealPhase =
  | { kind: 'idle' }
  | { kind: 'capturing'; wanted: ThemePreference; shown: ShownTheme }
  | { kind: 'revealing'; shown: ShownTheme };

let phase: RevealPhase = { kind: 'idle' };
const listeners = new Set<() => void>();

function enter(next: RevealPhase) {
  phase = next;
  for (const listener of listeners) listener();
}

/** A read the compiler cannot narrow away: picks made during the await land here. */
function pickedWhileCapturing(): ThemePreference | null {
  const now: RevealPhase = phase;
  return now.kind === 'capturing' ? now.wanted : null;
}

function twoFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/**
 * Switches the theme with a circle opening from `origin`, or at once when there is no origin,
 * no native module (iOS, Expo Go, an old dev client), or the screenshot fails.
 */
export async function switchTheme(next: ThemePreference, origin?: RevealOrigin): Promise<void> {
  if (phase.kind === 'capturing') {
    enter({ ...phase, wanted: next });
    return;
  }
  if (phase.kind === 'revealing' || !origin || !themeReveal) {
    setThemePreference(next);
    return;
  }
  const shown = Uniwind.currentTheme === 'dark' ? 'dark' : 'light';
  enter({ kind: 'capturing', wanted: next, shown });
  try {
    const captured = await themeReveal.capture().catch(() => false);
    const committed = nextThemeCommit(COMMIT_WAIT_MS);
    const wanted = pickedWhileCapturing() ?? next;
    enter({ kind: 'revealing', shown });
    setThemePreference(wanted);
    if (!captured) return;
    await committed;
    await twoFrames();
    await themeReveal.reveal(origin.x, origin.y, REVEAL_MS);
  } catch {
    // The native side fades a screenshot nobody opened, so a failed reveal only loses the circle.
  } finally {
    enter({ kind: 'idle' });
  }
}

/** The centre of option `index` in a `Segmented` whose track `measureInWindow` reported. */
export function segmentCentre(
  track: { x: number; y: number; width: number; height: number },
  index: number,
  count: number,
  inset = 4,
): RevealOrigin {
  const segment = (track.width - inset * 2) / count;
  return {
    x: track.x + inset + segment * (index + 0.5),
    y: track.y + track.height / 2,
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function heldBarTheme(): ShownTheme | null {
  return phase.kind === 'idle' ? null : phase.shown;
}

/** The theme the status bar keeps while a reveal runs, so its icons match the screenshot; null otherwise. */
export function useRevealHeldTheme(): ShownTheme | null {
  return useSyncExternalStore(subscribe, heldBarTheme, heldBarTheme);
}
