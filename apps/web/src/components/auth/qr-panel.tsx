'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/icon';
import {
  countdown,
  nextPollDelay,
  parseQrPoll,
  parseQrStart,
  qrReducer,
  signInLink,
  type QrState,
} from '@/lib/qr-sign-in';
import { createClient } from '@/lib/supabase/client';
import { PanelCat } from './auth-frame';
import { QrCode } from './qr-code';

const SCHEME = process.env.NEXT_PUBLIC_MONI_APP_SCHEME || 'moni';

// The panel shows from 1024 wide (auth.css). Narrower, it is hidden, so it asks for no code.
const PANEL_QUERY = '(min-width: 1024px)';

/** qr-start allows 10 live codes per address and answers 429 beyond that. */
function startFailure(error: { context?: unknown }): string {
  return error.context instanceof Response && error.context.status === 429
    ? 'Too many sign-in codes. Try again in a few minutes.'
    : "Moni couldn't make a sign-in code.";
}

function useShown(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(PANEL_QUERY);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(PANEL_QUERY).matches,
    () => false,
  );
}

/** "Sign in with your phone": shows a rotating code, polls until the phone approves, then signs in. */
export function QrPanel({ next }: { next: string }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(qrReducer, { kind: 'starting' });
  const [now, setNow] = useState(() => Date.now());
  const shown = useShown();

  useEffect(() => {
    if (state.kind !== 'starting' || !shown) return;
    let live = true;
    createClient()
      .functions.invoke('qr-start', { body: {} })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) dispatch({ type: 'failed', message: startFailure(error) });
        else dispatch({ type: 'started', start: parseQrStart(data) });
      })
      .catch(() => live && dispatch({ type: 'failed', message: "Moni couldn't make a sign-in code." }));
    return () => {
      live = false;
    };
  }, [state.kind, shown]);

  // One poll loop per request. It tracks the state it has seen itself, so a poll lands on the code it rotated.
  const showing = state.kind === 'showing' ? state : null;
  const pollSecret = showing?.pollSecret ?? null;
  useEffect(() => {
    if (showing === null) return;
    let live = true;
    let seen: QrState = showing;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const delay = nextPollDelay(seen, Date.now());
      if (delay !== null) timer = setTimeout(poll, delay);
    };
    const poll = () => {
      createClient()
        .functions.invoke('qr-poll', { body: { pollSecret: showing.pollSecret } })
        .then(({ data, error }) => {
          if (!live) return;
          if (!error) {
            const event = { type: 'polled', poll: parseQrPoll(data) } as const;
            seen = qrReducer(seen, event);
            dispatch(event);
          }
          schedule();
        })
        .catch(() => live && schedule());
    };
    schedule();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [pollSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (state.kind !== 'approved') return;
    createClient()
      .auth.verifyOtp({ token_hash: state.tokenHash, type: 'magiclink' })
      .then(({ error }) => {
        if (error) dispatch({ type: 'failed', message: "Moni couldn't finish signing you in." });
        else {
          router.replace(next);
          router.refresh();
        }
      });
  }, [state, next, router]);

  return (
    <aside className="auth-panel" aria-label="Sign in with your phone">
      <span className="auth-panel-kicker">Faster on a shared computer</span>
      <h2>Sign in with your phone</h2>
      <p>No password to type. Your phone already knows it&apos;s you.</p>
      <div className="qr-card" data-qr-state={state.kind}>
        {state.kind === 'showing' ? (
          <>
            <QrCode value={signInLink(state.code, SCHEME)} size={216} />
            <span className="meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="timer-sand-empty" size={16} />
              New code in <span className="num">{countdown(state.codeExpiresAt, now)}</span>
            </span>
          </>
        ) : (
          <div style={{ height: 244, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
            {state.kind === 'starting' || state.kind === 'approved' ? (
              <span className="meta">{state.kind === 'approved' ? 'Signing you in…' : 'Making a code…'}</span>
            ) : (
              <>
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {state.kind === 'expired' ? 'This code has expired' : state.message}
                </span>
                <button type="button" className="btn btn-sand press" onClick={() => dispatch({ type: 'restart' })}>
                  <Icon name="refresh" size={18} />
                  Show a new code
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="qr-steps">
        <span className="qr-step">
          <Icon name="cellphone" size={18} />
          Open Moni on your phone
        </span>
        <Icon name="chevron-right" size={18} />
        <span className="qr-step">
          <Icon name="account-circle-outline" size={18} />
          Profile
        </span>
        <Icon name="chevron-right" size={18} />
        <span className="qr-step">
          <Icon name="qrcode-scan" size={18} />
          Scan to sign in
        </span>
      </div>
      <PanelCat />
    </aside>
  );
}
