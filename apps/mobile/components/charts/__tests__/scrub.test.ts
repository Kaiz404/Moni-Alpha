import { nearestPoint, scrubPoints } from '@/components/charts/scrub';

describe('nearestPoint', () => {
  const { at } = scrubPoints([
    [1, 0],
    [4, 3],
    [10, 9],
  ]);

  it('finds the nearest point, the left one on a tie, and holds the ends past the edges', () => {
    expect([-5, 1, 2.5, 2.6, 7, 7.1, 10, 50].map((u) => nearestPoint(at, u))).toEqual([
      0, 0, 0, 1, 1, 2, 2, 2,
    ]);
  });

  it('lands on a lone point wherever the finger is', () => {
    expect(nearestPoint(scrubPoints([[5, 5]]).at, -100)).toBe(0);
  });
});
