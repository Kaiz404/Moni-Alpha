import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteAccountForm, FOR_GOOD, WhatIsDeleted } from '@/components/account/delete-account-form';
import { RequestLinkForm } from '@/components/account/request-link-form';
import { SiteFrame } from '@/components/account/site-frame';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Delete your Moni account · Moni',
  description: 'Delete your Moni account and everything Moni keeps for you, with or without the app.',
};

/**
 * The public deletion page the Play listing links to. Signed out, it lists what goes and emails a sign-in
 * link that comes back here; signed in, it is the same flow as Settings › Delete your account.
 */
export default async function DeleteAccountPage() {
  const { data } = await (await createClient()).auth.getClaims();
  const email = typeof data?.claims.email === 'string' ? data.claims.email : null;

  return (
    <SiteFrame>
      <span className="caps">Account</span>
      <h1 className="site-title">Delete your Moni account</h1>
      {data?.claims ? (
        <>
          <p className="site-lede">
            Signed in as <strong>{email ?? 'you'}</strong>. Type DELETE below and Moni deletes the account at once.
          </p>
          <DeleteAccountForm cancelHref="/" />
        </>
      ) : (
        <>
          <p className="site-lede">
            For anyone who no longer has the app. Enter the email you sign in with. Moni sends a link; opening it shows
            what is deleted and asks you to type DELETE.
          </p>
          <RequestLinkForm />
          <p className="site-small">
            Have the app or the web app? Settings › Profile › Delete your account does it at once. Or{' '}
            <Link className="link" href={`/login?next=${encodeURIComponent('/delete-account')}`}>
              sign in
            </Link>{' '}
            and come back here.
          </p>
          <div className="site-rule" />
          <WhatIsDeleted />
          <p className="delete-line">{FOR_GOOD}</p>
        </>
      )}
    </SiteFrame>
  );
}
