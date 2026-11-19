'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FieldError } from '@/components/auth/fields';
import { Icon } from '@/components/icon';
import { signOut } from '@/components/shell/shell-store';
import { ExportDataButton } from './export-data-button';
import { deleteAccount } from '@/lib/account-functions';
import { confirmsDeletion, DELETED, deletionFailure } from '@/lib/delete-account';
import './account.css';

export const DONE_PATH = '/delete-account/done';

/** W2-Parts' list of what goes. The public page shows it before sign-in too. */
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

/**
 * W2-Parts "Delete your account": what goes, Export data for a copy first, then DELETE typed in any letter case. The
 * button stays Sand until the word matches. Deleting calls the Edge Function with this browser's access
 * token, signs out the usual way and leaves the app for the done page.
 */
export function DeleteAccountForm({ cancelHref, userId, zone }: { cancelHref: string; userId: string; zone: string | null }) {
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
      <WhatIsDeleted />
      <div className="delete-note">
        <Icon name="download" size={20} />
        <span className="delete-note-line">Keep a copy first: a CSV of every transaction.</span>
        <ExportDataButton userId={userId} zone={zone} className="btn delete-export press" />
      </div>
      <p className="delete-line">{FOR_GOOD}</p>
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
        <Link href={cancelHref} className="btn btn-sand press">
          Cancel
        </Link>
        <button type="submit" className="btn btn-over press" disabled={!confirmed || deleting} aria-busy={deleting}>
          <Icon name="delete-outline" size={20} />
          {deleting ? 'Deleting' : 'Delete my account'}
        </button>
      </div>
    </form>
  );
}
