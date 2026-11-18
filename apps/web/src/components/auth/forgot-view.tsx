'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { authErrorStatus, statusMessage, type FormStatus } from '@/lib/auth-form';
import { countdown } from '@/lib/qr-sign-in';
import { createClient } from '@/lib/supabase/client';
import { AuthFrame } from './auth-frame';
import { FieldError, TextField } from './fields';
import { QrPanel } from './qr-panel';

const RESEND_AFTER_MS = 60_000;

/** W2-Auth "Reset your password": email in, a lilac "Link sent" note with a resend countdown out. */
export function ForgotView({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<FormStatus>({ kind: 'idle' });
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (sentAt === null) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [sentAt]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!email.trim()) return setStatus({ kind: 'failed', message: 'Add the email you signed up with.' });
    setStatus({ kind: 'busy', via: 'password' });
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/reset`,
    });
    if (error) return setStatus(authErrorStatus('signIn', error.message));
    setStatus({ kind: 'idle' });
    setSentAt(Date.now());
    setNow(Date.now());
  }

  const resendAt = sentAt === null ? 0 : sentAt + RESEND_AFTER_MS;
  const message = statusMessage(status);

  return (
    <AuthFrame panel={<QrPanel next="/home" />}>
      <Link href="/login" className="btn btn-sand press" style={{ alignSelf: 'flex-start', height: 36, padding: '0 14px 0 10px', fontSize: 14 }}>
        <Icon name="chevron-left" size={18} />
        Back to sign in
      </Link>
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-lede">Enter the email you signed up with. Moni sends a link to set a new password.</p>
      <form onSubmit={send} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextField
          id="email"
          label="Email"
          icon="email-outline"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {message && <FieldError>{message}</FieldError>}
        {sentAt === null ? (
          <button type="submit" className="btn btn-ink btn-lg press" disabled={status.kind === 'busy'}>
            Send link
          </button>
        ) : (
          <div className="auth-note motion-rise" role="status" style={{ animation: 'rise-in var(--duration-sheet) var(--ease-sheet) both' }}>
            <span className="auth-note-icon">
              <Icon name="email-check-outline" size={22} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong style={{ fontSize: 17 }}>Link sent</strong>
              <span>
                Check {email.trim()} for a link to set a new password. It works for 1 hour.
              </span>
              <span style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 14 }}>
                {now < resendAt ? (
                  <span style={{ color: 'var(--color-on-lilac)' }}>
                    Resend in <span className="num">{countdown(resendAt, now)}</span>
                  </span>
                ) : (
                  <button type="button" style={{ fontWeight: 700 }} onClick={() => send()}>
                    Resend
                  </button>
                )}
                <Link href="/login" style={{ fontWeight: 700 }}>
                  Back to sign in
                </Link>
              </span>
            </div>
          </div>
        )}
      </form>
    </AuthFrame>
  );
}
