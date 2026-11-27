import { dayGrid, monthGrid, pageOf, yearGrid, yearMonthGrid } from '@/lib/dates/grid-pages';

const ids = (cells: readonly ({ id: string } | null)[]) => cells.map((cell) => cell?.id ?? null);

describe('monthGrid', () => {
  it('puts Jan to Dec on one page, four to a row', () => {
    const grid = monthGrid();
    expect(grid.columns).toBe(4);
    expect(grid.pages).toHaveLength(1);
    expect(grid.pages[0].cells.map((cell) => cell?.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
    expect(grid.pages[0].cells[3]).toEqual({ id: '4', label: 'Apr', accessibilityLabel: 'April' });
  });
});

describe('yearMonthGrid', () => {
  it('pages each year Jan to Dec and leaves the months outside the range empty', () => {
    const grid = yearMonthGrid('2025-11', '2026-10');
    expect(grid.columns).toBe(4);
    expect(grid.pages.map((page) => page.label)).toEqual(['2025', '2026']);
    expect(ids(grid.pages[0].cells)).toEqual([null, null, null, null, null, null, null, null, null, null, '2025-11', '2025-12']);
    expect(grid.pages[1].cells[9]).toEqual({ id: '2026-10', label: 'Oct', accessibilityLabel: 'October 2026' });
    expect(grid.pages[1].cells[10]).toBeNull();
    expect(pageOf(grid, '2025-12')).toBe(0);
  });
});

describe('yearGrid', () => {
  it('pages 101 years by decade, oldest first, leaving the years outside the range empty', () => {
    const grid = yearGrid(2026, 101);
    expect(grid.columns).toBe(5);
    expect(grid.pages.map((page) => page.label)).toEqual([
      '1920s', '1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s',
    ]);
    expect(ids(grid.pages[0].cells)).toEqual([null, null, null, null, null, null, '1926', '1927', '1928', '1929']);
    expect(ids(grid.pages[10].cells)).toEqual(['2020', '2021', '2022', '2023', '2024', '2025', '2026', null, null, null]);
  });
});

describe('dayGrid', () => {
  it('lays a month out Sunday first and leaves the days outside the range empty', () => {
    const grid = dayGrid('2026-10-14', '2026-11-13', '2026-10-14');
    expect(grid.columns).toBe(7);
    expect(grid.heads).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(grid.pages.map((page) => page.label)).toEqual(['October 2026', 'November 2026']);

    const october = grid.pages[0].cells;
    expect(october).toHaveLength(4 + 31);
    expect(ids(october.slice(0, 4 + 13))).toEqual(Array(4 + 13).fill(null));
    expect(october[4 + 13]).toEqual({ id: '2026-10-14', label: '14', accessibilityLabel: 'Today' });

    const november = grid.pages[1].cells;
    expect(ids(november.slice(0, 1))).toEqual(['2026-11-01']);
    expect(ids(november).at(-1)).toBeNull();
    expect(ids(november).filter(Boolean).at(-1)).toBe('2026-11-13');
  });
});

describe('dayGrid with a date already set', () => {
  it('adds the months back to an earlier date and keeps only that day pickable', () => {
    const grid = dayGrid('2026-10-14', '2026-11-13', '2026-10-14', '2026-08-31');
    expect(grid.pages.map((page) => page.label)).toEqual(['August 2026', 'September 2026', 'October 2026', 'November 2026']);
    const days = grid.pages.flatMap((page) => page.cells).filter((cell) => cell);
    expect(days[0]?.id).toBe('2026-08-31');
    expect(days[1]?.id).toBe('2026-10-14');
  });

  it('adds the months on to a later date', () => {
    const grid = dayGrid('2026-10-14', '2026-11-13', '2026-10-14', '2027-01-02');
    expect(grid.pages.map((page) => page.label)).toEqual(['October 2026', 'November 2026', 'December 2026', 'January 2027']);
    expect(ids(grid.pages[3].cells).filter(Boolean)).toEqual(['2027-01-02']);
  });
});

describe('pageOf', () => {
  const grid = yearGrid(2026, 101);

  it('opens on the picked year, else the fallback, else the first page', () => {
    expect(pageOf(grid, '1987', '2008')).toBe(6);
    expect(pageOf(grid, null, '2008')).toBe(8);
    expect(pageOf(grid, null)).toBe(0);
    expect(pageOf(grid, '1800')).toBe(0);
  });
});
