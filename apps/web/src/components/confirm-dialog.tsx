'use client';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@ui-sdk/react/alert-dialog';
import { useRef, useState } from 'react';
import { Glyph } from '@/components/ledger/glyph';

/**
 * W2-Parts' confirm before a write that takes something away: the title, what it does, Cancel (focused,
 * Esc) and the red action. Undo still comes in the toast after. ui-sdk's alert dialog keeps Tab inside,
 * makes the page under it inert and plays the exit before the answer goes back. Keys stop here, so J, K
 * or R never act on the screen underneath while it asks.
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
  const [open, setOpen] = useState(true);
  const answer = useRef<'cancel' | 'confirm'>('cancel');
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        answer.current = details.returnValue === 'confirm' ? 'confirm' : 'cancel';
        setOpen(false);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        if (answer.current === 'confirm') onConfirm();
        else onCancel();
      }}
    >
      <AlertDialogBackdrop className="scrim scrim-center" />
      <AlertDialogContent
        className="dialog confirm-dialog motion-pop"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <AlertDialogTitle className="dialog-title">{title}</AlertDialogTitle>
        {children}
        <AlertDialogDescription className="confirm-line">{line}</AlertDialogDescription>
        <div className="confirm-actions">
          <AlertDialogClose value="cancel" className="btn btn-sand press">
            Cancel
            <span className="kbd">Esc</span>
          </AlertDialogClose>
          <AlertDialogClose value="confirm" className="btn confirm-danger press">
            <Glyph name={icon} size={18} />
            {action}
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
