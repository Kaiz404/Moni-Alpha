'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Where a screen is lives in the URL (the month, the selected row, an open form), so a reload or a
 * resize across a breakpoint keeps it. Setting a value keeps every other param, Moni chat's pane too.
 */
export function useQueryParams(): [URLSearchParams, (patch: Record<string, string | null>, how?: 'push' | 'replace') => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = useCallback(
    (patch: Record<string, string | null>, how: 'push' | 'replace' = 'replace') => {
      // The live URL, not the params this render saw: an Undo runs long after its render.
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router[how](`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [pathname, router],
  );
  return [params, set];
}

/**
 * How a slide-over closes (#106). Opening one from the page pushes the address, so Back closes it; closing
 * one this tab opened steps back the same way, so Back after it leaves the page. One a link opened closes in place.
 */
export function useStepBack(open: boolean, close: () => void): () => void {
  const router = useRouter();
  const was = useRef(open);
  const pushed = useRef(false);
  useEffect(() => {
    if (open !== was.current) pushed.current = open;
    was.current = open;
  }, [open]);
  return () => {
    if (!pushed.current) return close();
    pushed.current = false;
    router.back();
  };
}
