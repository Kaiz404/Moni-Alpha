import {
  drag,
  FLING_COMMIT_THRESHOLD,
  projectedPosition,
  springs,
  type SpringToken,
} from '@/lib/motion/tokens';

function overshoot({ stiffness, damping, mass }: { stiffness: number; damping: number; mass: number }) {
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
    const commits = (x: number, v: number) => projectedPosition(x, v) / width > FLING_COMMIT_THRESHOLD;

    expect(projectedPosition(100, 400)).toBe(300);
    expect(commits(170, 0)).toBe(true);
    expect(commits(60, 300)).toBe(true);
    expect(commits(60, 0)).toBe(false);
  });
});
