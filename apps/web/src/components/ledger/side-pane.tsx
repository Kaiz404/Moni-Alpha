'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useShellApi } from '@/components/shell/shell-context';
import { PANE_COVERS_QUERY } from '@/lib/layout';
import { KeysAsleep } from '@/lib/screen-keys';
import { PANE_SPANS, type PaneName } from '@/lib/sizes';
import { ResizeHandle, useRootWidth, useStoredSize } from './resize-handle';
import './side-pane.css';

/**
 * The docked pane every screen shares (Activity's transaction, Budget's category, Debts' person, Home's
 * Review). It exists only while something is open: it slides in from the right and the page makes room on
 * the sheet spring, and on close it slides out before it unmounts. Docked from top to bottom on the sidebar
 * and on the rail from 1240 wide, over the page with a scrim below that, the pushed page on the phone layout.
 * Its left edge drags it wider or narrower, and each pane keeps its width in this browser (#95).
 */
export function SidePane({
  label,
  name,
  open,
  onClose,
  children,
}: {
  label: string;
  /** Which pane, for its width: W2-Activity draws 380, W2-Budget and W2-Debts 408. */
  name: PaneName;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [present, setPresent] = useState(open);
  const kept = useRef<ReactNode>(children);
  if (open) kept.current = children;
  if (open && !present) setPresent(true);
  const span = PANE_SPANS[name];
  const [width, setWidth] = useStoredSize(`pane-${name}`, span);
  useRootWidth('--side-pane-width', width, present);

  const aside = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Moni chat takes the pane's place while it shows and a resize can change the layout, so both re-decide.
  // This runs before the focus below, so on close the page is live again before the focus goes back to it.
  const { pane: shellPane } = useShellApi();
  useLayoutEffect(() => {
    if (!open) return;
    const pane = aside.current;
    const shut: HTMLElement[] = [];
    const update = () => {
      for (const each of shut.splice(0)) each.inert = false;
      if (pane && covers(pane)) shut.push(...pageBehind(pane));
      for (const each of shut) each.inert = true;
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      for (const each of shut) each.inert = false;
    };
  }, [open, shellPane]);

  useLayoutEffect(() => {
    if (!open) return;
    const pane = aside.current;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const heading = pane?.querySelector<HTMLElement>('h1, h2, h3');
    if (heading && !heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    if (pane && covers(pane)) (heading ?? pane).focus({ preventScroll: true });
    return () => {
      const back = opener.current;
      if (pane?.contains(document.activeElement) || document.activeElement === document.body) {
        if (back?.isConnected) back.focus({ preventScroll: true });
        else (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
  }, [open]);

  useEffect(() => {
    if (open || !present) return;
    // The fallback ends the slide out where no animation runs (Moni chat hides the pane meanwhile).
    const timer = window.setTimeout(() => setPresent(false), 480);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  if (!present) return null;
  const closing = !open;
  return (
    <>
      <div className="side-pane-scrim" data-open={open || undefined} onMouseDown={onClose} />
      <aside
        ref={aside}
        tabIndex={-1}
        className="side-pane"
        aria-label={label}
        inert={closing}
        data-open={open || undefined}
        data-closing={closing || undefined}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) setPresent(false);
        }}
      >
        <KeysAsleep.Provider value={closing}>{open ? children : kept.current}</KeysAsleep.Provider>
      </aside>
      {open && <ResizeHandle label={`Resize the ${label.toLowerCase()} pane`} span={span} value={width} grows="left" onChange={setWidth} className="side-pane-resize" />}
    </>
  );
}

/** The pane hides the page: the full-screen pushed page on the phone layout, or over the page with a scrim. */
function covers(pane: HTMLElement): boolean {
  return getComputedStyle(pane).display !== 'none' && window.matchMedia(PANE_COVERS_QUERY).matches;
}

/** Everything a keyboard or a reader could reach behind the pane: the page around it and the navs. */
function pageBehind(pane: HTMLElement): HTMLElement[] {
  const behind: HTMLElement[] = [];
  for (let node: HTMLElement = pane; node.parentElement && !node.parentElement.classList.contains('shell'); node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert && !sibling.matches('.side-pane-scrim, .side-pane-resize')) behind.push(sibling);
    }
  }
  for (const nav of document.querySelectorAll<HTMLElement>('.shell > nav')) if (!nav.inert) behind.push(nav);
  return behind;
}
