import { useCallback, useState } from 'react';

export const PAGE_SIZE = 20;

/** One page of a list, numbered from 1, with where it sits in the whole list. */
export type Page<T> = {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  /** The position of the page's first row, from 1. 0 for an empty list. */
  first: number;
  /** The position of the page's last row. 0 for an empty list. */
  last: number;
};

/** A page past the end, left behind when the list shrank, reads as the last page. */
export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(pageCount, Math.max(1, Math.floor(page)));
  const start = (current - 1) * size;
  const shown = rows.slice(start, start + size);
  return {
    rows: shown,
    page: current,
    pageCount,
    total,
    first: total ? start + 1 : 0,
    last: start + shown.length,
  };
}

/** The current page, back to 1 whenever `listKey` changes: a new filter is a new list. */
export function usePageNumber(listKey: string): [number, (page: number) => void] {
  const [state, setState] = useState({ listKey, page: 1 });
  const setPage = useCallback((page: number) => setState({ listKey, page }), [listKey]);
  return [state.listKey === listKey ? state.page : 1, setPage];
}
