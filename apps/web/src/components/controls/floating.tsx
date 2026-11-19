'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  intersect,
  placeFloating,
  type Align,
  type Side,
} from '@/lib/floating';
import './controls.css';

const ROWS =
  '[role="option"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';
const CHOSEN = '[aria-selected="true"],[aria-checked="true"]';

/** Open popovers, newest last: Esc closes only the top one. */
const stack: object[] = [];

function rowsOf(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(ROWS)].filter(
    (row) => !row.matches(':disabled,[aria-disabled="true"]'),
  );
}

/**
 * A popover in the top layer, placed beside its anchor (or at a click) so it fits inside the window
 * and `boundary`, flipping side or edge when it must. It closes on Esc or a press outside, gives the
 * focus back to the anchor, and moves through its rows with the arrow keys.
 */
export function Floating({
  anchor,
  point,
  boundary,
  side,
  align = 'start',
  matchWidth = false,
  autoFocus = true,
  role,
  label,
  className,
  onClose,
  children,
}: {
  anchor: { readonly current: HTMLElement | null };
  /** A click in viewport pixels, for a menu that opens where the pointer is. */
  point?: { x: number; y: number };
  /** The popover stays inside this element too, as the row menu stays off the docked pane. */
  boundary?: { readonly current: HTMLElement | null };
  side?: Side;
  align?: Align;
  /** At least as wide as the anchor, as a select's list is. */
  matchWidth?: boolean;
  /** Off when the focus stays in a field outside, as the category cell's search does. */
  autoFocus?: boolean;
  role: 'listbox' | 'menu' | 'dialog';
  label: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    const element = ref.current!;
    const target = anchor.current;
    element.showPopover?.();
    const place = () => {
      if (!target?.isConnected) return;
      const box = target.getBoundingClientRect();
      const from = point
        ? { left: point.x, top: point.y, width: 0, height: 0 }
        : box;
      if (matchWidth)
        element.style.minWidth = `max(220px, ${box.width}px)`;
      element.style.maxHeight = '';
      const viewport = {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const within = boundary?.current
        ? intersect(
            boundary.current.getBoundingClientRect(),
            viewport,
          )
        : viewport;
      const spot = placeFloating(
        from,
        { width: element.offsetWidth, height: element.offsetHeight },
        within,
        { side, align },
      );
      element.style.left = `${spot.left}px`;
      element.style.top = `${spot.top}px`;
      element.style.maxHeight =
        spot.maxHeight === null ? '' : `${spot.maxHeight}px`;
      element.style.transformOrigin = spot.origin;
      element.dataset.side = spot.side;
    };
    place();
    const scrolled = (event: Event) => {
      if (!element.contains(event.target as Node)) place();
    };
    const resized = new ResizeObserver(place);
    resized.observe(element);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', scrolled, true);
    return () => {
      resized.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', scrolled, true);
    };
  }, [anchor, point, boundary, side, align, matchWidth]);

  useEffect(() => {
    const element = ref.current!;
    const target = anchor.current;
    const self = {};
    stack.push(self);
    if (autoFocus && !element.contains(document.activeElement)) {
      const rows = rowsOf(element);
      (
        rows.find((row) => row.matches(CHOSEN)) ??
        rows[0] ??
        element.querySelector<HTMLElement>('[data-focus-first]')
      )?.focus({ preventScroll: true });
    }
    const away = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!element.contains(node) && !target?.contains(node))
        closeRef.current();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || stack.at(-1) !== self) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', escape, true);
    return () => {
      stack.splice(stack.indexOf(self), 1);
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', escape, true);
      const focus = document.activeElement;
      if (
        target?.isConnected &&
        (!focus || focus === document.body || element.contains(focus))
      )
        target.focus({ preventScroll: true });
    };
  }, [anchor, autoFocus]);

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    // The screen's own keys (J, K, X, Enter) must not act on the rows behind an open popover.
    event.stopPropagation();
    if (event.key === 'Tab' && role !== 'dialog') {
      onClose();
      return;
    }
    const current = event.target as HTMLElement;
    if (!current.matches(ROWS)) return;
    const rows = rowsOf(event.currentTarget);
    const at = rows.indexOf(current);
    const next = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: rows.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    rows[(next + rows.length) % rows.length]?.focus();
  };

  return (
    <div
      ref={ref}
      popover="manual"
      role={role}
      aria-label={label}
      className={`popover motion-pop${className ? ` ${className}` : ''}`}
      onKeyDown={keys}
    >
      {children}
    </div>
  );
}
