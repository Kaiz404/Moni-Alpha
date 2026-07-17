import {
  buildActivityCalendar,
  buildDonutSegments,
  buildMonthlyTakeaway,
  findNearestLinePointIndex,
  projectLinePoints,
} from '../chart-utils';

describe('chart geometry', () => {
  it('maps positive donut values to a complete circle and ignores empty data', () => {
    const segments = buildDonutSegments([{ value: 1 }, { value: 3 }]);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.percentage).toBeCloseTo(0.25);
    expect(segments[1]?.endAngle).toBeCloseTo(-Math.PI / 2 + Math.PI * 2);
    expect(buildDonutSegments([{ value: 0 }])).toEqual([]);
  });

  it('projects and selects the nearest line point without assuming a value range', () => {
    const points = projectLinePoints(
      [
        { x: 10, y: 4 },
        { x: 20, y: 4 },
        { x: 30, y: 4 },
      ],
      220,
      120,
      { top: 10, right: 10, bottom: 10, left: 10 },
    );
    expect(points[0]?.chartY).toBe(60);
    expect(findNearestLinePointIndex(points, points[1]!.chartX + 3)).toBe(1);
    expect(findNearestLinePointIndex([], 30)).toBeNull();
  });
});

describe('insight derivation', () => {
  it('creates an aligned calendar with intensity isolated to the selected currency input', () => {
    const cells = buildActivityCalendar('2026-07', [
      { dateKey: '2026-07-01', amount: 12, transactionCount: 1 },
      { dateKey: '2026-07-17', amount: 48, transactionCount: 2 },
    ]);
    const first = cells.find((cell) => cell.dateKey === '2026-07-01');
    const busiest = cells.find((cell) => cell.dateKey === '2026-07-17');
    expect(first?.intensity).toBeCloseTo(0.25);
    expect(busiest?.intensity).toBe(1);
    expect(cells).toHaveLength(35);
  });

  it('uses a deterministic, plain-language monthly takeaway', () => {
    expect(
      buildMonthlyTakeaway({
        total: 120,
        previousTotal: 100,
        leadingCategoryName: 'Food & Dining',
      }),
    ).toMatchObject({ trend: 'up', headline: 'Spending is up 20% this month' });
    expect(
      buildMonthlyTakeaway({
        total: 0,
        previousTotal: 20,
        leadingCategoryName: null,
      }),
    ).toMatchObject({ trend: 'empty' });
  });
});
