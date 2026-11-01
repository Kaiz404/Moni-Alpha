import { act, renderHook } from '@testing-library/react-native';

import { pageOf, usePageNumber } from '@/lib/finance/paged';

const rows = Array.from({ length: 45 }, (_, index) => index + 1);

describe('pageOf', () => {
  it('cuts the list into pages and says where the page sits', () => {
    const page = pageOf(rows, 2);
    expect(page.rows[0]).toBe(21);
    expect(page.rows.at(-1)).toBe(40);
    expect(page).toMatchObject({ page: 2, pageCount: 3, total: 45, first: 21, last: 40 });
  });

  it('gives the last page what is left', () => {
    expect(pageOf(rows, 3)).toMatchObject({ first: 41, last: 45, rows: [41, 42, 43, 44, 45] });
  });

  it('reads a page past the end as the last page, after a filter shrank the list', () => {
    expect(pageOf(rows, 9).page).toBe(3);
    expect(pageOf(rows.slice(0, 5), 3)).toMatchObject({ page: 1, pageCount: 1, rows: [1, 2, 3, 4, 5] });
  });

  it('has one empty page for an empty list', () => {
    expect(pageOf([], 1)).toEqual({ rows: [], page: 1, pageCount: 1, total: 0, first: 0, last: 0 });
  });
});

describe('usePageNumber', () => {
  it('goes back to page 1 on a new list, and stays there on return to the old one', () => {
    const { result, rerender } = renderHook(({ listKey }) => usePageNumber(listKey), {
      initialProps: { listKey: 'all' },
    });
    act(() => result.current[1](3));
    expect(result.current[0]).toBe(3);
    rerender({ listKey: 'grab' });
    expect(result.current[0]).toBe(1);
    rerender({ listKey: 'all' });
    expect(result.current[0]).toBe(1);
  });
});
