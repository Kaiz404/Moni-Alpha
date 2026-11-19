'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import './side-pane.css';

/**
 * The docked pane every screen shares (Activity's transaction, Budget's category, Debts' person, Home's
 * Review). It exists only while something is open: it slides in from the right and the page makes room on
 * the sheet spring, and on close it slides out before it unmounts. Docked from top to bottom on the sidebar
 * and on the rail from 1240 wide, over the page with a scrim below that, the pushed page on the phone layout.
 */
export function SidePane({
  label,
  open,
  width = 408,
  onClose,
  children,
}: {
  label: string;
  open: boolean;
  /** The board's pane width: 408 on W2-Budget and W2-Debts, 380 on W2-Activity. */
  width?: 380 | 408;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [present, setPresent] = useState(open);
  const kept = useRef<ReactNode>(children);
  if (open) kept.current = children;
  if (open && !present) setPresent(true);

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
        data-width={width}
        style={{ '--side-pane-width': `${width}px` } as CSSProperties}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget)
            setPresent(false);
        }}
      >
        {open ? children : kept.current}
      </aside>
    </>
  );
}
