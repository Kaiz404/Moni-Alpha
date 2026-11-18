/** A spring in the shape Reanimated's `withSpring` takes. */
export type Spring = {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
};

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
} as const satisfies Record<string, Spring>;

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

const STEP_MS = 0.25;
const HORIZON_MS = 1200;
const POINTS = 40;

/** The spring from 0 to 1 sampled every 0.25 ms, and the time after which it stays within 0.1 % of 1. */
function simulate({ stiffness, damping, mass }: Spring) {
  const samples: number[] = [];
  let x = 0;
  let v = 0;
  for (let t = 0; t <= HORIZON_MS; t += STEP_MS) {
    samples.push(x);
    for (let sub = 0; sub < 4; sub++) {
      const a = (-stiffness * (x - 1) - damping * v) / mass;
      v += (a * STEP_MS) / 4000;
      x += (v * STEP_MS) / 4000;
    }
  }
  let last = samples.length - 1;
  while (last >= 0 && Math.abs(samples[last]! - 1) <= 0.001) last--;
  return { samples, settleMs: last * STEP_MS };
}

/** Rounds a tie to the even neighbour, as the board generator's Python `round` does. */
function roundHalfEven(x: number) {
  const n = Math.round(x);
  return n - x === 0.5 && n % 2 !== 0 ? n - 1 : n;
}

function point(p: number) {
  return p === 0 || p === 1 ? p.toFixed(1) : p.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * The spring as a CSS easing: `linear()` through 40 points of its settle time, and that time as the
 * transition's duration. The same simulation drew the W2-Motion board's curves.
 */
export function springCurve(spring: Spring): { linear: string; durationMs: number } {
  const { samples, settleMs } = simulate(spring);
  const points = Array.from(
    { length: POINTS },
    (_, i) =>
      samples[Math.min(samples.length - 1, roundHalfEven((settleMs * i) / POINTS / STEP_MS))]!,
  );
  return { linear: `linear(${[...points, 1].map(point).join(', ')})`, durationMs: settleMs };
}
