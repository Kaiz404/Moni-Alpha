/** What a scrub reached: a day or bar with transactions, or a quiet one. */
export type TickKind = 'data' | 'quiet';

/** `strong` is the normal tick, `light` the lighter one made for fast runs, null is silence. */
export type TickPlay = 'strong' | 'light' | null;

/**
 * Ticks closer than this blur into a buzz on a phone's motor, so a glide plays at most about
 * 22 a second, however many days it crosses.
 */
export const TICK_GAP_MS = 45;

/**
 * Spaces a scrub's ticks so a fast glide never buzzes. A quiet day inside the gap is dropped; a
 * day with transactions inside the gap is held and plays, strong, at the next free slot, so the
 * days that matter keep their tick. One governor per touch.
 */
export function tickGovernor(gapMs = TICK_GAP_MS) {
  let last = -Infinity;
  let held = false;
  return {
    /** The first touch: always the strong tick. */
    land(now: number): TickPlay {
      last = now;
      held = false;
      return 'strong';
    },
    offer(now: number, kind: TickKind): TickPlay {
      if (now - last < gapMs) {
        if (kind === 'data') held = true;
        return null;
      }
      last = now;
      const strong = kind === 'data' || held;
      held = false;
      return strong ? 'strong' : 'light';
    },
  };
}
