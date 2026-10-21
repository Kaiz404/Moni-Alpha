import type { WithSpringConfig } from 'react-native-reanimated';

// No reduceMotion field: Reanimated already defaults it to ReduceMotion.System.
export const springs = {
  /** Press squish, colour, digit roll. */
  press: { stiffness: 1600, damping: 80, mass: 1 },
  /** Lines, bars, rings, anything encoding money. */
  value: { stiffness: 700, damping: 47.6, mass: 1 },
  /** Segmented pill, tab pill, the + morph. */
  control: { stiffness: 800, damping: 33.9, mass: 1 },
  /** Sheets, cards expanding in place. */
  sheet: { stiffness: 380, damping: 31.2, mass: 1 },
  /** Snap-back after a fling; pass the release velocity. */
  throw: { stiffness: 157.9, damping: 17.6, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

export type SpringToken = keyof typeof springs;

/**
 * Anything under the finger tracks it 1:1 with no spring while held. On
 * release, hand the gesture velocity to `sheet` or `throw`.
 */
export const drag = { ratio: 1 } as const;

/** A fling commits when its projected position passes this share of the travel. */
export const FLING_COMMIT_THRESHOLD = 0.4;

/** v in px/s. */
export function projectedPosition(position: number, velocity: number): number {
  'worklet';
  return position + 0.5 * velocity;
}
