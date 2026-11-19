'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
        className="side-pane"
        aria-label={label}
        aria-hidden={closing || undefined}
        data-open={open || undefined}
        data-closing={closing || undefined}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) setPresent(false);
        }}
      >
        {open ? children : kept.current}
      </aside>
      {open && <ResizeHandle label={`Resize the ${label.toLowerCase()} pane`} span={span} value={width} grows="left" onChange={setWidth} className="side-pane-resize" />}
    </>
  );
}
