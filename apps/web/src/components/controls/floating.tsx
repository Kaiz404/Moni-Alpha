'use client';

import { bindLayer, position } from '@ui-sdk/core';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  TYPE_AHEAD_MS,
  typeAheadIndex,
  type Align,
  type Side,
} from '@/lib/floating';
import './controls.css';

const ROWS =
  '[role="option"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';
const CHOSEN = '[aria-selected="true"],[aria-checked="true"]';
const EDGE = 8;

function rowsOf(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(ROWS)].filter(
    (row) => !row.matches(':disabled,[aria-disabled="true"]'),
  );
}

/**
 * A popover in the top layer, placed by ui-sdk beside its anchor (or at a click) so it stays on screen,
 * flipping side or edge when it must, and kept between `boundary`'s sides. It joins ui-sdk's layer
 * stack, so Esc and a press outside close the top popover first. Focus tabbing out closes it too, the
 * focus goes back to the anchor, and the arrow keys move through its rows.
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
  /** The popover stays between this element's left and right edges too, as a row menu stays inside its table. */
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
    if (matchWidth && target)
      element.style.minWidth = `max(220px, ${target.getBoundingClientRect().width}px)`;
    const stopLayer = bindLayer(element, {
      topLayer: true,
      contains: (node) => !!target?.contains(node),
      onDismiss: (reason, event) => {
        if (reason === 'escape-key') {
          // Esc closes this popover only, never the pane or page under it.
          event.preventDefault();
          event.stopPropagation();
        }
        closeRef.current();
      },
    });
    // ui-sdk flips the side and slides along the edge; Moni's popovers flip to the anchor's other edge first.
    const edge = (): Align => {
      const fence = boundary?.current?.getBoundingClientRect() ?? {
        left: 0,
        right: window.innerWidth,
      };
      const from = point
        ? { left: point.x, width: 0 }
        : target?.getBoundingClientRect();
      if (!from) return align;
      const width = element.offsetWidth;
      const startFits = from.left + width <= fence.right - EDGE;
      const endFits = from.left + from.width - width >= fence.left + EDGE;
      if (align === 'start' && !startFits && endFits) return 'end';
      if (align === 'end' && !endFits && startFits) return 'start';
      return align;
    };
    const stopPosition = position(
      () => point ?? anchor.current,
      element,
      () => ({
        side: side ?? 'bottom',
        align: edge(),
        sideOffset: 6,
        collisionPadding: EDGE,
      }),
    );
    return () => {
      stopPosition();
      stopLayer();
    };
  }, [anchor, point, boundary, side, align, matchWidth]);

  useEffect(() => {
    const element = ref.current!;
    const target = anchor.current;
    if (autoFocus && !element.contains(document.activeElement)) {
      const rows = rowsOf(element);
      const first =
        rows.find((row) => row.matches(CHOSEN)) ??
        rows[0] ??
        element.querySelector<HTMLElement>('[data-focus-first]');
      first?.focus({ preventScroll: true });
      first?.scrollIntoView({ block: 'nearest' });
    }
    let pressing = false;
    const pressed = () => {
      pressing = true;
    };
    const released = () => {
      pressing = false;
    };
    // A press is ui-sdk's outside press; this is Tab or Shift+Tab leaving a dialog, which would otherwise stay open.
    const left = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (!pressing && next && !element.contains(next)) closeRef.current();
    };
    document.addEventListener('pointerdown', pressed, true);
    document.addEventListener('pointerup', released, true);
    document.addEventListener('pointercancel', released, true);
    element.addEventListener('focusout', left);
    return () => {
      document.removeEventListener('pointerdown', pressed, true);
      document.removeEventListener('pointerup', released, true);
      document.removeEventListener('pointercancel', released, true);
      element.removeEventListener('focusout', left);
      const focus = document.activeElement;
      if (
        target?.isConnected &&
        (!focus || focus === document.body || element.contains(focus))
      )
        target.focus({ preventScroll: true });
    };
  }, [anchor, autoFocus]);

  const typed = useRef({ text: '', at: 0 });
  const typeAhead = (
    event: KeyboardEvent<HTMLDivElement>,
    rows: HTMLElement[],
    at: number,
  ) => {
    const fresh = event.timeStamp - typed.current.at > TYPE_AHEAD_MS;
    if (
      event.key.length !== 1 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (event.key === ' ' && fresh)
    )
      return null;
    const text = (fresh ? '' : typed.current.text) + event.key;
    typed.current = { text, at: event.timeStamp };
    const labels = rows.map(
      (row) =>
        (row.querySelector('.popover-row-text') ?? row).textContent ?? '',
    );
    return rows[typeAheadIndex(labels, at, text)] ?? null;
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    // The screen's own keys (J, K, X, Enter) must not act on the rows behind an open popover. Esc is ui-sdk's.
    if (event.key !== 'Escape') event.stopPropagation();
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
    if (next !== undefined) {
      event.preventDefault();
      rows[(next + rows.length) % rows.length]?.focus();
      return;
    }
    const match = typeAhead(event, rows, at);
    if (match) {
      event.preventDefault();
      match.focus();
    }
  };

  return (
    <div
      ref={ref}
      role={role}
      aria-label={label}
      className={`popover motion-pop${className ? ` ${className}` : ''}`}
      onKeyDown={keys}
    >
      {children}
    </div>
  );
}
