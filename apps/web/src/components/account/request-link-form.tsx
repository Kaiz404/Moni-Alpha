'use client';

import { isAuthApiError } from '@supabase/supabase-js';
import { useState } from 'react';
import { FieldError, TextField } from '@/components/auth/fields';
import { Icon } from '@/components/icon';
import { createClient } from '@/lib/supabase/client';
import { OFFLINE } from '@/lib/auth-form';

type Sent = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'offline' };

/**
 * W2-Parts "On the public site, without the app": Moni emails a sign-in link that comes back to this
 * page. It answers the same way whether or not the email has an account, so it never says which is which.
 */
export function RequestLinkForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<Sent>({ kind: 'idle' });

  async function send() {
    const address = email.trim();
    if (!address || sent.kind === 'sending') return;
    setSent({ kind: 'sending' });
    const { error } = await createClient().auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/delete-account')}`,
      },
    });
    setSent(error && !isAuthApiError(error) ? { kind: 'offline' } : { kind: 'sent', email: address });
  }

  if (sent.kind === 'sent') {
    return (
      <div className="request-sent" role="status">
        <Icon name="email-fast-outline" size={24} />
        <p>
          If <strong>{sent.email}</strong> has a Moni account, a link is on its way. It works for an hour, and sometimes
          lands in spam.
        </p>
        <button type="button" className="btn btn-sand press" onClick={() => setSent({ kind: 'idle' })}>
          Use another email
        </button>
      </div>
    );
  }

  return (
    <form
      className="request-link"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <TextField
        id="delete-email"
        label="Email"
        icon="email-outline"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      {sent.kind === 'offline' && <FieldError>{OFFLINE}</FieldError>}
      <button type="submit" className="btn btn-ink press" disabled={sent.kind === 'sending'}>
        Email me a link
      </button>
    </form>
  );
}
