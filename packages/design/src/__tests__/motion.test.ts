import { describe, expect, it } from 'vitest';

import {
  drag,
  FLING_COMMIT_THRESHOLD,
  projectedPosition,
  springCurve,
  springs,
  type Spring,
  type SpringToken,
} from '../motion';

function overshoot({ stiffness, damping, mass }: Spring) {
  const ratio = damping / (2 * Math.sqrt(stiffness * mass));
  return ratio >= 1 ? 0 : Math.exp((-Math.PI * ratio) / Math.sqrt(1 - ratio * ratio));
}

describe('motion tokens', () => {
  it('matches the tokens.md spring table', () => {
    expect(springs).toEqual({
      press: { stiffness: 1600, damping: 80, mass: 1 },
      value: { stiffness: 700, damping: 47.6, mass: 1 },
      control: { stiffness: 800, damping: 33.9, mass: 1 },
      sheet: { stiffness: 380, damping: 31.2, mass: 1 },
      throw: { stiffness: 157.9, damping: 17.6, mass: 1 },
    });
    expect(drag).toEqual({ ratio: 1 });
  });

  it.each<[SpringToken, number]>([
    ['press', 0],
    ['value', 0.1],
    ['control', 9.4],
    ['sheet', 1.4],
    ['throw', 4.5],
  ])('%s overshoots about %s%%, as V2F-Motion documents', (token, percent) => {
    expect(overshoot(springs[token]) * 100).toBeCloseTo(percent, 0);
  });

  it('commits a slow drag past 40% and a short fast fling', () => {
    const width = 390;
    const commits = (x: number, v: number) =>
      projectedPosition(x, v) / width > FLING_COMMIT_THRESHOLD;

    expect(projectedPosition(100, 400)).toBe(300);
    expect(commits(170, 0)).toBe(true);
    expect(commits(60, 300)).toBe(true);
    expect(commits(60, 0)).toBe(false);
  });
});

describe('springCurve', () => {
  it('samples the press spring over its settle time, as the W2-Motion board generator does', () => {
    expect(springCurve(springs.press)).toEqual({
      linear:
        'linear(0.0, 0.023, 0.0788, 0.153, 0.2356, 0.3236, 0.4055, 0.4822, 0.5525, 0.6157, 0.6719, 0.7212, 0.7658, 0.8025, 0.8341, 0.861, 0.8838, 0.9031, 0.9194, 0.9331, 0.9445, 0.9545, 0.9624, 0.969, 0.9744, 0.979, 0.9827, 0.9858, 0.9884, 0.9905, 0.9922, 0.9937, 0.9948, 0.9958, 0.9965, 0.9972, 0.9977, 0.9981, 0.9985, 0.9988, 1.0)',
      durationMs: 231.25,
    });
  });

  it('keeps the throw overshoot above 1 and settles slower than every other spring', () => {
    expect(springCurve(springs.throw).linear).toContain(', 1.0458, ');
    expect(
      Object.fromEntries(
        Object.entries(springs).map(([name, s]) => [name, springCurve(s).durationMs]),
      ),
    ).toEqual({
      press: 231.25,
      value: 316,
      control: 359,
      sheet: 434.5,
      throw: 818.25,
    });
  });
});
