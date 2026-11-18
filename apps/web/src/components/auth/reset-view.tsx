'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-form';
import { createClient } from '@/lib/supabase/client';
import { AuthFrame } from './auth-frame';
import { FieldError, PasswordField } from './fields';
import { PromoPanel } from './promo-panel';

/** Where the reset link lands (signed in by the link): set the new password, then go Home. */
export function ResetView() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    const { error: failed } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (failed) return setError("Moni couldn't save it. Open the link from your email again.");
    router.replace('/home');
    router.refresh();
  }

  return (
    <AuthFrame panel={<PromoPanel />}>
      <h1 className="auth-title">Set a new password</h1>
      <p className="auth-lede">Use at least 8 characters. Moni signs you in with it from now on.</p>
      <form onSubmit={save} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            value={password}
            invalid={error !== null}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <button type="submit" className="btn btn-ink btn-lg press" disabled={busy}>
          Save password
        </button>
      </form>
    </AuthFrame>
  );
}
