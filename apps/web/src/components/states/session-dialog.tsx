'use client';

import { useState, type FormEvent } from 'react';
import { Glyph } from '@/components/ledger/glyph';
import { useShellApi } from '@/components/shell/shell-context';
import { setShell } from '@/components/shell/shell-store';
import { authErrorStatus, statusMessage } from '@/lib/auth-form';
import { moniStore } from '@/lib/moni-store';

/**
 * W2-States, Session expired: Sign in again as a dialog over the page, never a redirect, so the page,
 * its filters and anything half-typed stay behind the scrim. No cat on a security screen.
 */
export function SessionDialog() {
  const { user, run } = useShellApi();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const store = moniStore();
    const { error: failed } = await store.supabase.auth.signInWithPassword({ email: user.email, password });
    setBusy(false);
    if (failed) return setError(statusMessage(authErrorStatus('signIn', failed.message)));
    setShell({ overlay: 'none' });
    store.authReady$.set(true);
    void store.enableStoreSync();
  }

  async function google() {
    const here = `${window.location.pathname}${window.location.search}`;
    await moniStore().supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(here)}` },
    });
  }

  return (
    <div className="scrim scrim-center session-scrim">
      <form role="dialog" aria-modal="true" aria-labelledby="session-title" className="dialog session-dialog motion-pop" onSubmit={signIn}>
        <h2 id="session-title" className="session-title">
          <Glyph name="lock-outline" size={24} />
          Sign in again
        </h2>
        <p className="session-line">You&apos;ve been signed out to keep your money private. Sign in and you&apos;ll be back on this page, with your filters and anything you typed.</p>
        <label className="session-field">
          <span>Email</span>
          <input value={user.email} readOnly />
        </label>
        <label className="session-field">
          <span>Password</span>
          <input type="password" autoFocus autoComplete="current-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && (
          <p className="session-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-ink session-submit press" disabled={!password || busy}>
          Sign in
          <span className="kbd kbd-on-ink">Enter</span>
        </button>
        <button type="button" className="btn session-google press" onClick={() => void google()}>
          <Glyph name="google" size={20} />
          Continue with Google
        </button>
        <button type="button" className="link session-out" onClick={() => run({ kind: 'signOut' })}>
          Not {user.name}? Sign out
        </button>
      </form>
    </div>
  );
}
