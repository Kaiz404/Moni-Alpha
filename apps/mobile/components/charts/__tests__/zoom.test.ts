import { areaPath, barBox, barTop, barsPath, linePath } from '@/components/charts/zoom';

const line = { left: 54, right: 310, top: 44, base: 142 };
const bars = { left: 54, right: 310, top: 44, base: 141.2 };
const values = (...list: number[]) => Float64Array.from(list);

describe('linePath', () => {
  it('puts the viewport edge to edge and the domain top to base', () => {
    const path = linePath(values(0, 10, 20, 30, 40), 0, 4, 0, 40, 0, line, 1);
    expect(path).toEqual({ d: 'M54,142 L118,117.5 L182,93 L246,68.5 L310,44', startX: 54, endX: 310 });
    expect(areaPath(path, line)).toBe('M54,142 L118,117.5 L182,93 L246,68.5 L310,44 L310,142 L54,142 Z');
  });

  it('cuts the line exactly at a viewport edge that falls between two days', () => {
    expect(linePath(values(0, 10, 20, 30, 40), 1.5, 3.5, 0, 40, 0, line, 1).d).toBe(
      'M54,105.3 L118,93 L246,68.5 L310,56.3',
    );
  });

  it('keeps one point per pixel column, so three years cost the plot width', () => {
    const days = Float64Array.from({ length: 1000 }, (_, day) => day);
    const { d } = linePath(days, 0, 999, 0, 999, 0, line, 1);
    const points = d.split(' ');
    expect(points).toHaveLength(257);
    expect(points[0]).toBe('M54.8,141.7');
    expect(points.at(-1)).toBe('L310,44');
  });

  it('reads values from the range start when shifted', () => {
    expect(linePath(values(0, 10, 20), 1, 2, 0, 10, 10, line, 1).d).toBe('M54,142 L310,44');
  });

  it('draws in from the left as reveal grows', () => {
    expect(linePath(values(0, 10, 20, 30, 40), 0, 4, 0, 40, 0, line, 0.5).d).toBe(
      'M54,142 L118,117.5 L182,93',
    );
  });

  it('leaves days before a wallet began undrawn', () => {
    expect(linePath(values(NaN, NaN, 5, 5), 0, 3, 0, 10, 0, line, 1).d).toBe('M224.7,93 L310,93');
  });

  it('spans the plot with a lone day', () => {
    expect(linePath(values(500), 0, 0, 0, 1000, 0, line, 1).d).toBe('M54,93 L310,93');
  });
});

describe('bars', () => {
  it('centres a bar on its days and fits its width between 3 and 12', () => {
    expect(barBox(1, 1, 0, 3, bars)).toEqual({ centre: 182, width: 12 });
    const month = barBox(0, 0, 0, 30, bars);
    expect(month.centre).toBeCloseTo(58.27, 2);
    expect(month.width).toBeCloseTo(6.53, 2);
    expect(barBox(0, 0, 0, 365, bars).width).toBe(3);
  });

  it('tops the highest bar on the top gridline and keeps an empty day 4 tall', () => {
    expect(barTop(100, 100, bars, 1)).toBeCloseTo(44, 5);
    expect(barTop(0, 100, bars, 1)).toBeCloseTo(137.2, 5);
    expect(barTop(100, 100, bars, 0.5)).toBeCloseTo(92.25, 5);
  });

  it('draws only the buckets in the viewport, and only the part above even pace for Coral', () => {
    const [starts, sums] = [values(0, 1, 2), values(0, 50, 100)];
    const count = (d: string) => d.split('Z').length - 1;
    expect(count(barsPath(starts, starts, sums, 0, 3, 100, bars, 1, 1, null))).toBe(3);
    expect(count(barsPath(starts, starts, sums, 1, 3, 100, bars, 1, 1, null))).toBe(2);
    const coral = barsPath(starts, starts, sums, 0, 3, 100, bars, 1, 1, 60);
    expect(count(coral)).toBe(1);
    expect(coral).toContain('V76.9');
  });
});
