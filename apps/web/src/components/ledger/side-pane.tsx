'use client';

import type { CSSProperties, ReactNode } from 'react';
import './side-pane.css';

/**
 * The docked detail pane every screen shares (Activity's transaction, Budget's category, Debts' person).
 * One element for every layout: docked on the right from top to bottom on the sidebar and on the rail
 * from 1240 wide, over the page with a scrim below that, the pushed page on the phone layout. `idle`
 * keeps it docked with its placeholder while nothing is open, as Budget and Debts draw it.
 */
export function SidePane({
  label,
  open,
  idle = false,
  width = 408,
  onClose,
  children,
}: {
  label: string;
  open: boolean;
  idle?: boolean;
  /** The board's pane width: 408 on W2-Budget and W2-Debts, 380 on W2-Activity. */
  width?: 380 | 408;
  onClose: () => void;
  children?: ReactNode;
}) {
  if (!open && !idle) return null;
  return (
    <>
      <div className="side-pane-scrim" data-open={open || undefined} onMouseDown={onClose} />
      <aside
        className="side-pane"
        aria-label={label}
        data-open={open || undefined}
        data-idle={idle || undefined}
        data-width={width}
        style={{ '--side-pane-width': `${width}px` } as CSSProperties}
      >
        {children}
      </aside>
    </>
  );
}
