'use client';

import { useEffect, useId, useRef } from 'react';
import { Glyph } from '@/components/ledger/glyph';

/**
 * W2-Parts' confirm before a write that takes something away: the title, what it does, Cancel (focused,
 * Esc) and the red action. Undo still comes in the toast after. Keys stop here, so J, K or R never act on
 * the screen underneath while it asks.
 */
export function ConfirmDialog({
  title,
  line,
  action,
  icon,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  line: string;
  action: string;
  icon: string;
  children?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="scrim scrim-center" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dialog confirm-dialog motion-pop"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') onCancel();
        }}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {children}
        <p className="confirm-line">{line}</p>
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="btn btn-sand press" onClick={onCancel}>
            Cancel
            <span className="kbd">Esc</span>
          </button>
          <button type="button" className="btn confirm-danger press" onClick={onConfirm}>
            <Glyph name={icon} size={18} />
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
