'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useShellApi } from '@/components/shell/shell-context';
import { useLayout } from '@/components/shell/use-layout';
import { panelBesidePage } from '@/lib/layout';
import { KeysAsleep } from '@/lib/screen-keys';
import { PANE_SPANS, type PaneName } from '@/lib/sizes';
import { Glyph } from './glyph';
import { ResizeHandle, useRootWidth, useStoredSize } from './resize-handle';
import './side-panel.css';

/** The chevrons that step through the list beside the side panel, as J and K do. */
export type SidePanelSteps = {
  noun: string;
  position: string;
  onMove: (by: 1 | -1) => void;
  first: boolean;
  last: boolean;
};

/**
 * The side panel every item without a page of its own opens in (#150): a transaction, a category, a person,
 * Home's Review and the wallet forms. It fills the shell's right slot, the one Moni chat docks in: on the
 * sidebar and the rail it slides in from the right and the page narrows beside it, still live, so picking
 * another row swaps `item` in place. On the one-column rail there is no room, so it covers the page with a
 * scrim and the page goes inert. "‹ <page>" and Esc close it, and the screen keeps what is open in the URL,
 * so Back and a shared link work. Its left edge drags it wider or narrower, kept per pane in this browser
 * (#95). On the phone layout it is the pushed page.
 */
export function SidePanel({
  label,
  name,
  item,
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
  /** What the panel shows; a new one swaps in place with a short fade. */
  item?: string;
  /** Where "‹ <back>" and Esc go: the page beside, or a step inside the side panel with its own `onBack`. */
  back: string;
  onBack?: () => void;
  steps?: SidePanelSteps;
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
  useRootWidth('--side-panel-width', width, present);
  const layout = useLayout();
  const covers = layout !== null && !panelBesidePage(layout);

  const aside = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Where it covers the page, the page goes inert. Moni chat takes the panel's place while it shows, so the
  // page is live again meanwhile. This runs before the focus below, so on close the page is live before focus returns.
  const { pane: shellPane } = useShellApi();
  useLayoutEffect(() => {
    const pane = aside.current;
    if (!open || !covers || !pane || !shown(pane)) return;
    const shut = pageBehind(pane);
    for (const each of shut) each.inert = true;
    return () => {
      for (const each of shut) each.inert = false;
    };
  }, [open, covers, shellPane]);

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

  // Another row picked while it is open swaps the content in place: the panel stays, its body fades in anew.
  const lastItem = useRef(item);
  useLayoutEffect(() => {
    const before = lastItem.current;
    lastItem.current = item;
    const pane = aside.current;
    if (!open || !pane || before === undefined || before === item) return;
    pane.scrollTop = 0;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const child of pane.children) {
      if (child.classList.contains('side-panel-head')) continue;
      child.animate(still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], {
        duration: 180,
        easing: 'ease-out',
      });
    }
  }, [item, open]);

  useEffect(() => {
    if (open || !present) return;
    // The fallback ends the slide out where no animation runs (Moni chat hides the side panel meanwhile).
    const timer = window.setTimeout(() => setPresent(false), 480);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  if (!present) return null;
  const closing = !open;
  return (
    <>
      <div className="side-panel-scrim" data-open={open || undefined} onMouseDown={onClose} />
      <aside
        ref={aside}
        tabIndex={-1}
        className="side-panel"
        aria-label={label}
        inert={closing}
        data-open={open || undefined}
        data-closing={closing || undefined}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) setPresent(false);
        }}
      >
        <div className="side-panel-head" data-only="sidebar rail rail-one-column">
          <button type="button" className="side-panel-back press" aria-label={`Back to ${back} (Esc)`} onClick={onBack ?? onClose}>
            <Glyph name="chevron-left" size={20} />
            {back}
            <span className="kbd">Esc</span>
          </button>
          <span className="side-panel-end">
            {steps && (
              <span className="side-panel-steps">
                <span className="meta num">{steps.position}</span>
                <button type="button" className="icon-round icon-round-key side-panel-step press" aria-label={`Previous ${steps.noun} (K)`} disabled={steps.first} onClick={() => steps.onMove(-1)}>
                  <Glyph name="chevron-up" size={20} />
                  <span className="kbd kbd-inline">K</span>
                </button>
                <button type="button" className="icon-round icon-round-key side-panel-step press" aria-label={`Next ${steps.noun} (J)`} disabled={steps.last} onClick={() => steps.onMove(1)}>
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
      {open && <ResizeHandle label={`Resize the ${label.toLowerCase()} pane`} span={span} value={width} grows="left" sizes="previous" onChange={setWidth} className="side-panel-resize" />}
    </>
  );
}

/** Moni chat hides the side panel while it shows. */
function shown(pane: HTMLElement): boolean {
  return getComputedStyle(pane).display !== 'none';
}

/** Everything a keyboard or a reader could reach under a covering side panel: the page around it and the navs. */
function pageBehind(pane: HTMLElement): HTMLElement[] {
  const behind: HTMLElement[] = [];
  for (let node: HTMLElement = pane; node.parentElement && !node.parentElement.classList.contains('shell'); node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert && !sibling.matches('.side-panel-scrim, .side-panel-resize')) behind.push(sibling);
    }
  }
  for (const nav of document.querySelectorAll<HTMLElement>('.shell > nav')) if (!nav.inert) behind.push(nav);
  return behind;
}
