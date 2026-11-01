import {
  arcPath,
  ringHit,
  ringPoint,
  ringSegments,
  type RingSegment,
} from '@/components/budget/ring-geometry';

const options = {
  radius: 100,
  strokeWidth: 30,
  gap: 10,
  minSweep: 2,
  maxSegments: 8,
};

const angles = (segments: RingSegment[]) =>
  segments.map(({ start, sweep }) => [start, sweep]);

function expectAngles(segments: RingSegment[], expected: number[][]) {
  expect(segments).toHaveLength(expected.length);
  angles(segments).forEach(([start, sweep], index) => {
    expect(start).toBeCloseTo(expected[index][0], 2);
    expect(sweep).toBeCloseTo(expected[index][1], 2);
  });
}

describe('ringSegments', () => {
  it.each([
    ['one category leaves one gap between its own ends', [500], [[11.54, 336.93]]],
    [
      'two equal categories are the same length',
      [100, 100],
      [
        [11.54, 156.93],
        [191.54, 156.93],
      ],
    ],
    [
      'a tiny value next to a huge one keeps the smallest capsule',
      [1, 1000],
      [
        [11.54, 311.85],
        [346.46, 2],
      ],
    ],
    [
      'three to one is read on the visible length, caps included',
      [300, 100],
      [
        [11.54, 244.02],
        [278.63, 69.84],
      ],
    ],
  ])('%s', (_name, values, expected) => {
    expectAngles(ringSegments(values, options), expected);
  });

  it('draws nothing for a zero total, and skips a zero next to real spending', () => {
    expect(ringSegments([], options)).toEqual([]);
    expect(ringSegments([0, 0], options)).toEqual([]);
    expect(ringSegments([0, 40], options).map((segment) => segment.indexes)).toEqual([[1]]);
  });

  it('puts the biggest first and folds the smallest into one last arc past the count', () => {
    const values = [5, 900, 40, 700, 30, 500, 20, 300, 10, 100, 2, 1];
    const segments = ringSegments(values, options);
    expect(segments.map((segment) => segment.indexes)).toEqual([
      [1],
      [3],
      [5],
      [7],
      [9],
      [2],
      [4],
      [6, 8, 0, 10, 11],
    ]);
    expect(segments[7].value).toBe(38);
    expectAngles(segments, [
      [11.54, 71.41],
      [106.02, 51.7],
      [180.79, 32],
      [235.87, 12.3],
      [271.24, 2],
      [296.32, 2],
      [321.39, 2],
      [346.46, 2],
    ]);
  });

  it('shares follow the values even when the floor stretches the arc', () => {
    const [huge, tiny] = ringSegments([1000, 1], options);
    expect(huge.share).toBeCloseTo(0.999, 3);
    expect(tiny.share).toBeCloseTo(0.001, 3);
  });

  it.each([
    ['one', [10]],
    ['two', [10, 10]],
    ['lopsided', [1000, 300, 2, 1]],
    ['the seed month', [349.8, 235.3, 149.3, 140, 96.5, 45, 40.5, 38, 21.8]],
    ['all tiny', [1, 1, 1, 1, 1, 1, 1, 1]],
    ['more than fit', Array.from({ length: 40 }, (_, index) => index + 1)],
  ])('keeps every gap at the same clear distance and closes the ring: %s', (_name, values) => {
    const segments = ringSegments(values, options);
    segments.forEach((segment, index) => {
      const next = segments[(index + 1) % segments.length];
      const between = (next.start - (segment.start + segment.sweep) + 360) % 360;
      const chord = 2 * options.radius * Math.sin((between / 2) * (Math.PI / 180));
      expect(chord - options.strokeWidth).toBeCloseTo(options.gap, 6);
      expect(segment.sweep).toBeGreaterThanOrEqual(options.minSweep - 1e-9);
    });
  });

  it('never lays out more arcs than the ring holds, whatever the count asked for', () => {
    const thick = { radius: 60, strokeWidth: 40, gap: 20, minSweep: 2, maxSegments: 50 };
    const values = Array.from({ length: 20 }, () => 10);
    expect(ringSegments(values, thick)).toHaveLength(5);
  });
});

describe('ringHit', () => {
  const segments = ringSegments([300, 100], options);
  const band = { radius: 100, strokeWidth: 30, slop: 8 };

  it.each([
    ['the middle of the hole', 0, 0, { kind: 'centre' }],
    ['the inner edge just past the slop', 0, 76, { kind: 'centre' }],
    ['the first arc at 3 o clock', 100, 0, { kind: 'segment', index: 0 }],
    ['the first arc, in the slop past its outer edge', 122, 0, { kind: 'segment', index: 0 }],
    ['the second arc at 9 o clock', -100, 0, { kind: 'segment', index: 1 }],
    ['the gap at 12 o clock, nearer the second arc', -1, -100, { kind: 'segment', index: 1 }],
    ['the gap at 12 o clock, nearer the first arc', 1, -100, { kind: 'segment', index: 0 }],
    ['outside the band', 124, 0, null],
  ])('%s', (_name, x, y, expected) => {
    expect(ringHit(segments, x, y, band)).toEqual(expected);
  });

  it('has nothing but the middle to hit on an empty ring', () => {
    expect(ringHit([], 100, 0, band)).toBeNull();
    expect(ringHit([], 0, 0, band)).toEqual({ kind: 'centre' });
  });
});

describe('arcPath', () => {
  it('runs clockwise from 12 o clock and takes the long way past half a turn', () => {
    expect(arcPath(100, 50, 0, 90)).toBe('M100.00 50.00A50 50 0 0 1 150.00 100.00');
    expect(arcPath(100, 50, 0, 270)).toBe('M100.00 50.00A50 50 0 1 1 50.00 100.00');
  });

  it('puts a point at 6 o clock straight below the centre', () => {
    const { x, y } = ringPoint(100, 50, 180);
    expect(x).toBeCloseTo(100, 6);
    expect(y).toBeCloseTo(150, 6);
  });
});
