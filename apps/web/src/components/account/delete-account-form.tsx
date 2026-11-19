'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FieldError } from '@/components/auth/fields';
import { Icon } from '@/components/icon';
import { signOut } from '@/components/shell/shell-store';
import { ExportDataButton } from './export-data-button';
import { deleteAccount } from '@/lib/account-functions';
import { confirmsDeletion, DELETED, deletionFailure } from '@/lib/delete-account';
import './account.css';

export const DONE_PATH = '/delete-account/done';

/** W2-Parts' list of what goes, on the public page the Play listing links to. */
export function WhatIsDeleted() {
  return (
    <section className="deleted-list" aria-labelledby="what-is-deleted">
      <h2 id="what-is-deleted" className="caps">
        What is deleted
      </h2>
      <ul>
        {DELETED.map((item) => (
          <li key={item.text}>
            <Icon name={item.icon} size={20} />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const FOR_GOOD = "It goes at once and can't be undone. Copies in Moni's backups are gone within 7 days.";

/** The one line the Settings dialog says about what goes, as the phone's sheet does. */
export const WHAT_GOES = 'Everything Moni keeps for you goes for good, on every device.';

/** Cancel leaves for a page on the public site, or closes the dialog in Settings. */
type Cancel = { href: string } | { close: () => void };

/**
 * W2-Parts "Delete your account": Export data first, then DELETE typed in any letter case. The button
 * stays Sand until the word matches. Deleting calls the Edge Function with this browser's access token,
 * signs out the usual way and leaves the app for the done page.
 */
export function DeleteAccountForm({ cancel, userId, zone }: { cancel: Cancel; userId: string; zone: string | null }) {
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const confirmed = confirmsDeletion(typed);

  async function remove() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setFailure(null);
    const failed = deletionFailure(await deleteAccount());
    if (failed) {
      setDeleting(false);
      setFailure(failed);
      return;
    }
    await signOut();
    router.replace(DONE_PATH);
    router.refresh();
  }

  return (
    <form
      className="delete-account"
      onSubmit={(event) => {
        event.preventDefault();
        void remove();
      }}
    >
      <ExportDataButton userId={userId} zone={zone} label="Export data first" className="btn delete-export press" />
      <div>
        <div className="label">
          <label htmlFor="delete-confirm">Type DELETE to confirm</label>
        </div>
        <div className="field">
          <input
            id="delete-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={failure ? 'delete-failure' : undefined}
          />
        </div>
        {failure && (
          <div id="delete-failure">
            <FieldError>{failure}</FieldError>
          </div>
        )}
      </div>
      <div className="delete-actions">
        {'href' in cancel ? (
          <Link href={cancel.href} className="btn btn-sand press">
            Cancel
          </Link>
        ) : (
          <button type="button" className="btn btn-sand press" onClick={cancel.close}>
            Cancel
            <span className="kbd">Esc</span>
          </button>
        )}
        <button type="submit" className="btn btn-over press" disabled={!confirmed || deleting} aria-busy={deleting}>
          <Icon name="delete-outline" size={20} />
          {deleting ? 'Deleting' : 'Delete my account'}
        </button>
      </div>
    </form>
  );
}

/**
 * Settings › Profile › Delete your account: a confirm dialog, like the phone's sheet, with one line on
 * what goes. It opens on the DELETE field, keeps Tab inside, and hands focus back to the opener when
 * Esc, a click outside or Cancel closes it.
 */
export function DeleteAccountDialog({ userId, zone, onClose }: { userId: string; zone: string | null; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLInputElement>('#delete-confirm')?.focus();
    return () => opener?.focus();
  }, []);

  function trapTab(event: React.KeyboardEvent) {
    const stops = [...(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled)') ?? [])];
    const edge = event.shiftKey ? stops[0] : stops.at(-1);
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? stops.at(-1) : stops[0])?.focus();
  }

  return createPortal(
    <div className="scrim scrim-center" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-line"
        ref={dialog}
        className="dialog confirm-dialog motion-pop"
        onKeyDown={(event) => {
          if (event.key === 'Tab') return trapTab(event);
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          onClose();
        }}
      >
        <h2 id="delete-account-title" className="dialog-title">
          Delete your account
        </h2>
        <p id="delete-account-line" className="confirm-line">
          {WHAT_GOES}
        </p>
        <DeleteAccountForm cancel={{ close: onClose }} userId={userId} zone={zone} />
      </div>
    </div>,
    document.body,
  );
}
