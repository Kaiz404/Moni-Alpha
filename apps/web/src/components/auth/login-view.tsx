'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import {
  authErrorStatus,
  canCreate,
  checkAge,
  checkSignIn,
  MIN_PASSWORD_LENGTH,
  statusMessage,
  UNDER_AGE,
  type FormStatus,
} from '@/lib/auth-form';
import { createClient } from '@/lib/supabase/client';
import { AuthFrame } from './auth-frame';
import { FieldError, PasswordField, TextField } from './fields';
import { PromoPanel } from './promo-panel';
import { QrPanel } from './qr-panel';

export type LoginMode = 'signIn' | 'createAccount';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CALLBACK_FAILED: FormStatus = { kind: 'failed', message: "Moni couldn't finish signing you in. Try again." };

/** W2-Auth's sign in and create account, one page with the mode in the URL (`?mode=create`). */
export function LoginView({
  initialMode,
  next,
  initialEmail,
  callbackFailed,
}: {
  initialMode: LoginMode;
  next: string;
  initialEmail: string;
  callbackFailed: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [status, setStatus] = useState<FormStatus>(callbackFailed ? CALLBACK_FAILED : { kind: 'idle' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [agreed, setAgreed] = useState(false);

  const birth = birthYear && birthMonth ? `${birthYear}-${birthMonth}` : '';
  const age = checkAge(birth, new Date());
  const details = { name, email, password, birthMonth: birth, agreed };
  const busy = status.kind === 'busy';
  const message = statusMessage(status);
  const thisYear = new Date().getFullYear();

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setStatus({ kind: 'idle' });
    const params = new URLSearchParams(window.location.search);
    if (nextMode === 'createAccount') params.set('mode', 'create');
    else params.delete('mode');
    params.delete('error');
    const query = params.toString();
    window.history.replaceState(null, '', `/login${query ? `?${query}` : ''}`);
  }

  function edited<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      if (status.kind !== 'busy' && status.kind !== 'idle') setStatus({ kind: 'idle' });
    };
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    const problem = checkSignIn({ email, password });
    if (problem) return setStatus(problem);
    setStatus({ kind: 'busy', via: 'password' });
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) return setStatus(authErrorStatus('signIn', error.message));
    router.replace(next);
    router.refresh();
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    if (!age.ok || !canCreate(details, new Date())) return;
    setStatus({ kind: 'busy', via: 'password' });
    const { data, error } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim(), birth_month: age.birthMonth },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) return setStatus(authErrorStatus('createAccount', error.message));
    if (data.session) {
      router.replace(next);
      router.refresh();
    } else {
      router.push(`/login/verify?email=${encodeURIComponent(email.trim())}`);
    }
  }

  async function google() {
    setStatus({ kind: 'busy', via: 'google' });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setStatus(authErrorStatus('signIn', error.message));
  }

  const googleButton = (
    <button type="button" className="btn btn-sand btn-lg press" onClick={google} disabled={busy}>
      <Icon name="google" size={20} />
      Continue with Google
    </button>
  );

  return (
    <AuthFrame panel={mode === 'signIn' ? <QrPanel next={next} /> : <PromoPanel />}>
      <div className="auth-modes" role="group" aria-label="Sign in or create an account">
        <button type="button" aria-pressed={mode === 'signIn'} onClick={() => switchMode('signIn')}>
          Sign in
        </button>
        <button type="button" aria-pressed={mode === 'createAccount'} onClick={() => switchMode('createAccount')}>
          Create account
        </button>
      </div>

      {mode === 'signIn' ? (
        <form onSubmit={signIn} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="auth-title">Welcome back</h1>
          <TextField
            id="email"
            label="Email"
            icon="email-outline"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => edited(setEmail)(e.target.value)}
          />
          <div>
            <PasswordField
              id="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              invalid={status.kind === 'wrongDetails'}
              onChange={(e) => edited(setPassword)(e.target.value)}
            />
            {message && <FieldError>{message}</FieldError>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Link className="link" style={{ fontSize: 14 }} href={`/login/forgot${email ? `?email=${encodeURIComponent(email)}` : ''}`}>
                Forgot password?
              </Link>
            </div>
          </div>
          <button type="submit" className="btn btn-ink btn-lg press" disabled={busy} aria-busy={busy}>
            {status.kind === 'busy' && status.via === 'password' ? (
              <>
                <span className="auth-busy-dot" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Sign in <span className="kbd kbd-on-ink">Enter</span>
              </>
            )}
          </button>
          <div className="auth-or">or</div>
          {googleButton}
          <p style={{ margin: 0, textAlign: 'center', fontSize: 15, color: 'var(--color-ink-2)' }}>
            New to Moni?{' '}
            <button type="button" className="link" onClick={() => switchMode('createAccount')}>
              Create an account
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={createAccount} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="auth-title">Make your Moni</h1>
          <TextField
            id="name"
            label="Name"
            icon="account-outline"
            autoComplete="given-name"
            value={name}
            onChange={(e) => edited(setName)(e.target.value)}
          />
          <TextField
            id="email"
            label="Email"
            icon="email-outline"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => edited(setEmail)(e.target.value)}
          />
          <PasswordField
            id="new-password"
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => edited(setPassword)(e.target.value)}
            hint={
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: password.length >= MIN_PASSWORD_LENGTH ? 'var(--color-success)' : 'var(--color-muted)',
                }}
              >
                {password.length >= MIN_PASSWORD_LENGTH && <Icon name="check-circle" size={16} />}
                At least 8 characters
              </span>
            }
          />
          <div>
            <span className="label" id="dob-label">
              Date of birth
            </span>
            <div className="auth-row" role="group" aria-labelledby="dob-label">
              <div className="field" data-invalid={!age.ok && age.underAge ? 'true' : undefined}>
                <Icon name="calendar-blank-outline" size={20} />
                <select aria-label="Month" value={birthMonth} onChange={(e) => edited(setBirthMonth)(e.target.value)}>
                  <option value="">Month</option>
                  {MONTHS.map((label, i) => (
                    <option key={label} value={String(i + 1).padStart(2, '0')}>
                      {label}
                    </option>
                  ))}
                </select>
                <Icon name="chevron-down" size={20} />
              </div>
              <div className="field" data-invalid={!age.ok && age.underAge ? 'true' : undefined}>
                <select aria-label="Year" value={birthYear} onChange={(e) => edited(setBirthYear)(e.target.value)}>
                  <option value="">Year</option>
                  {Array.from({ length: 100 }, (_, i) => String(thisYear - i)).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <Icon name="chevron-down" size={20} />
              </div>
            </div>
            {!age.ok && age.underAge ? (
              <FieldError>{UNDER_AGE}</FieldError>
            ) : (
              <p className="meta" style={{ margin: '6px 0 0' }}>
                Moni is for people 18 and over. We keep only the month and year.
              </p>
            )}
          </div>
          <label className="auth-check">
            <input type="checkbox" checked={agreed} onChange={(e) => edited(setAgreed)(e.target.checked)} />
            <span>
              I agree to Moni&apos;s{' '}
              <Link className="link" href="/terms">
                Terms
              </Link>{' '}
              and{' '}
              <Link className="link" href="/privacy">
                Privacy Policy
              </Link>
              , which say what Moni stores and where.
            </span>
          </label>
          {message && <FieldError>{message}</FieldError>}
          <button
            type="submit"
            className="btn btn-ink btn-lg press"
            disabled={busy || !canCreate(details, new Date())}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <span className="auth-busy-dot" aria-hidden="true" />
                Creating your account…
              </>
            ) : (
              'Create account'
            )}
          </button>
          <div className="auth-or">or</div>
          {googleButton}
        </form>
      )}
    </AuthFrame>
  );
}
