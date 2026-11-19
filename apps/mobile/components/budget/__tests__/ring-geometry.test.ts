import { arcPath, ringPoint } from '@/components/budget/ring-geometry';

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
