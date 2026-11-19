'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { clampSize, parseSize, sizeForDrag, sizeForKey, type Span } from '@/lib/sizes';
import './resize-handle.css';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private windows refuse storage; the size then lasts until the tab closes.
  }
}

/** A size the viewer drags, kept in this browser under `moni-size-<name>`. */
export function useStoredSize(name: string, span: Span): [number, (next: number | null) => void] {
  const key = `moni-size-${name}`;
  const [size, setSize] = useState(span.initial);
  useLayoutEffect(() => setSize(parseSize(span, read(key))), [key, span]);
  const set = useCallback(
    (next: number | null) => {
      setSize(next ?? span.initial);
      store(key, next === null || next === span.initial ? null : String(next));
    },
    [key, span],
  );
  return [size, set];
}

/** Puts a docked pane's width on the root while it shows, where the page beside it reads it to make room. */
export function useRootWidth(variable: `--${string}`, width: number, shown: boolean) {
  useLayoutEffect(() => {
    if (!shown) return;
    const root = document.documentElement.style;
    root.setProperty(variable, `${width}px`);
    return () => void root.removeProperty(variable);
  }, [variable, width, shown]);
}

/**
 * A seam the viewer drags (W2-Activity, #95): a pane's left edge or a column's right edge. It shows on
 * hover and focus, takes the arrows (Shift for bigger steps), Home, End, and Enter or a double click for
 * the default size.
 */
export function ResizeHandle({
  label,
  span,
  value,
  grows,
  onChange,
  sizes,
  className,
}: {
  label: string;
  span: Span;
  value: number;
  /** The way the size grows: a pane on the right grows left, a column grows right. */
  grows: 'left' | 'right';
  /** The new size, or null for the default. */
  onChange: (next: number | null) => void;
  /** What it sizes: its parent (a column header) or the element before it (a pane). */
  sizes: 'parent' | 'previous';
  className?: string;
}) {
  const self = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);
  const target = () => (sizes === 'parent' ? self.current?.parentElement : self.current?.previousElementSibling);
  // The CSS caps a size (half the window, a share of the table), so a stored size can be wider than what shows.
  const showing = (width: number | null | undefined) => (width == null ? value : clampSize(span, Math.min(value, width)));
  /** Read at the moment of a key or a drag: the observer reports after paint, a step behind quick presses. */
  const now = () => showing(target()?.getBoundingClientRect().width);
  useLayoutEffect(() => {
    const sized = sizes === 'parent' ? self.current?.parentElement : self.current?.previousElementSibling;
    if (!sized) return;
    const observer = new ResizeObserver(() => setMeasured(sized.getBoundingClientRect().width));
    observer.observe(sized);
    return () => observer.disconnect();
  }, [sizes]);
  return (
    <div
      ref={self}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={span.min}
      aria-valuemax={span.max}
      aria-valuenow={showing(measured)}
      tabIndex={0}
      title={`${label}. Double-click for the default.`}
      className={['resize-handle', className].filter(Boolean).join(' ')}
      data-grows={grows}
      data-dragging={dragging || undefined}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, start: now() };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onChange(sizeForDrag(span, drag.current.start, event.clientX - drag.current.x, grows));
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onChange(null);
      }}
      onKeyDown={(event) => {
        const next = sizeForKey(span, now(), event.key, event.shiftKey, grows);
        if (next === null) return;
        event.preventDefault();
        event.stopPropagation();
        onChange(next === span.initial ? null : next);
      }}
    />
  );
}
