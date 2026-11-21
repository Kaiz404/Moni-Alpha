'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useShellApi } from '@/components/shell/shell-context';
import { KeysAsleep } from '@/lib/screen-keys';
import { PANE_SPANS, type PaneName } from '@/lib/sizes';
import { Glyph } from './glyph';
import { ResizeHandle, useRootWidth, useStoredSize } from './resize-handle';
import './slide-over.css';

/** The chevrons that step through the list behind the slide-over, as J and K do. */
export type SlideOverSteps = {
  noun: string;
  position: string;
  onMove: (by: 1 | -1) => void;
  first: boolean;
  last: boolean;
};

/**
 * The slide-over every item without a page of its own opens in (#106): a transaction, a category, a person,
 * a place, Home's Review and the wallet forms. It slides in from the right over most of the page on the sheet
 * spring and dims the page behind, which goes inert while focus moves in. "‹ <page>" and Esc close it, and
 * the screen keeps what is open in the URL, so Back and a shared link work. Its left edge drags it wider or
 * narrower, kept per pane in this browser (#95). On the phone layout it is the pushed page.
 */
export function SlideOver({
  label,
  name,
  back,
  onBack,
  steps,
  actions,
  open,
  onClose,
  children,
}: {
  label: string;
  name: PaneName;
  /** Where "‹ <back>" and Esc go: the page behind, or a step inside the slide-over with its own `onBack`. */
  back: string;
  onBack?: () => void;
  steps?: SlideOverSteps;
  /** The item's own buttons at the top right, such as Write off. */
  actions?: ReactNode;
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
  useRootWidth('--slide-over-width', width, present);

  const aside = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Moni chat takes the slide-over's place while it shows, so the page behind is live again meanwhile.
  // This runs before the focus below, so on close the page is live again before the focus goes back to it.
  const { pane: shellPane } = useShellApi();
  useLayoutEffect(() => {
    const pane = aside.current;
    if (!open || !pane || !shown(pane)) return;
    const shut = pageBehind(pane);
    for (const each of shut) each.inert = true;
    return () => {
      for (const each of shut) each.inert = false;
    };
  }, [open, shellPane]);

  useLayoutEffect(() => {
    if (!open) return;
    const pane = aside.current;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const heading = pane?.querySelector<HTMLElement>('h1, h2, h3');
    if (heading && !heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    if (pane && shown(pane)) (heading ?? pane).focus({ preventScroll: true });
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
    // The fallback ends the slide out where no animation runs (Moni chat hides the slide-over meanwhile).
    const timer = window.setTimeout(() => setPresent(false), 480);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  if (!present) return null;
  const closing = !open;
  return (
    <>
      <div className="slide-over-scrim" data-open={open || undefined} onMouseDown={onClose} />
      <aside
        ref={aside}
        tabIndex={-1}
        className="slide-over"
        aria-label={label}
        inert={closing}
        data-open={open || undefined}
        data-closing={closing || undefined}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) setPresent(false);
        }}
      >
        <div className="slide-over-head" data-only="sidebar rail rail-one-column">
          <button type="button" className="slide-over-back press" aria-label={`Back to ${back} (Esc)`} onClick={onBack ?? onClose}>
            <Glyph name="chevron-left" size={20} />
            {back}
            <span className="kbd">Esc</span>
          </button>
          <span className="slide-over-end">
            {steps && (
              <span className="slide-over-steps">
                <span className="meta num">{steps.position}</span>
                <button type="button" className="icon-round icon-round-key slide-over-step press" aria-label={`Previous ${steps.noun} (K)`} disabled={steps.first} onClick={() => steps.onMove(-1)}>
                  <Glyph name="chevron-up" size={20} />
                  <span className="kbd kbd-inline">K</span>
                </button>
                <button type="button" className="icon-round icon-round-key slide-over-step press" aria-label={`Next ${steps.noun} (J)`} disabled={steps.last} onClick={() => steps.onMove(1)}>
                  <Glyph name="chevron-down" size={20} />
                  <span className="kbd kbd-inline">J</span>
                </button>
              </span>
            )}
            {actions}
          </span>
        </div>
        <KeysAsleep.Provider value={closing}>{open ? children : kept.current}</KeysAsleep.Provider>
      </aside>
      {open && <ResizeHandle label={`Resize the ${label.toLowerCase()} pane`} span={span} value={width} grows="left" sizes="previous" onChange={setWidth} className="slide-over-resize" />}
    </>
  );
}

/** Moni chat hides the slide-over while it shows; otherwise it always covers the page. */
function shown(pane: HTMLElement): boolean {
  return getComputedStyle(pane).display !== 'none';
}

/** Everything a keyboard or a reader could reach behind the slide-over: the page around it and the navs. */
function pageBehind(pane: HTMLElement): HTMLElement[] {
  const behind: HTMLElement[] = [];
  for (let node: HTMLElement = pane; node.parentElement && !node.parentElement.classList.contains('shell'); node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert && !sibling.matches('.slide-over-scrim, .slide-over-resize')) behind.push(sibling);
    }
  }
  for (const nav of document.querySelectorAll<HTMLElement>('.shell > nav')) if (!nav.inert) behind.push(nav);
  return behind;
}
