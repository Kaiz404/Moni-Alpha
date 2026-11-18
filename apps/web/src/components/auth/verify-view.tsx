'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { createClient } from '@/lib/supabase/client';
import { AuthFrame } from './auth-frame';
import { PromoPanel } from './promo-panel';

/** W2-Auth "Check your email", after Create account when the project asks for a confirmed email. */
export function VerifyView({ email }: { email: string }) {
  const [resent, setResent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function resend() {
    setResent('sending');
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/home` },
    });
    setResent(error ? 'failed' : 'sent');
  }

  return (
    <AuthFrame panel={<PromoPanel />}>
      <span
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: 'var(--color-block-lilac)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="email-fast-outline" size={32} />
      </span>
      <h1 className="auth-title">Check your email</h1>
      <p className="auth-lede">
        Open the link we sent to {email ? <strong style={{ color: 'var(--color-foreground)' }}>{email}</strong> : 'your email'}, then
        come back here to sign in. It can take a minute, and sometimes lands in spam.
      </p>
      <div className="auth-card">
        <div className="auth-card-row">
          <span style={{ color: 'var(--color-ink-2)' }}>
            {resent === 'sent' ? 'Sent again.' : resent === 'failed' ? "Moni couldn't send it. Try again." : "Didn't get it?"}
          </span>
          <button type="button" className="btn btn-sand press" style={{ height: 40 }} onClick={resend} disabled={!email || resent === 'sending'}>
            <Icon name="refresh" size={18} />
            Resend email
          </button>
        </div>
        <div className="auth-card-row">
          <span style={{ color: 'var(--color-ink-2)' }}>Wrong email?</span>
          <Link className="link" href={`/login?mode=create&email=${encodeURIComponent(email)}`}>
            Change it
          </Link>
        </div>
      </div>
      <Link href={`/login?email=${encodeURIComponent(email)}`} className="btn btn-ink btn-lg press">
        I&apos;ve confirmed it, sign in
      </Link>
    </AuthFrame>
  );
}
