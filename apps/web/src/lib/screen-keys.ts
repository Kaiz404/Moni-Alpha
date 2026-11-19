'use client';

import { useEffect, useRef } from 'react';
import { useShellApi } from '@/components/shell/shell-context';
import { useShell } from '@/components/shell/shell-store';
import { INITIAL_KEY_STATE, keyStep, type KeyState } from '@/lib/keys';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * A screen's own keys (P and D on Home; J, K, X and Esc on Activity; J, K, E, R, M, D on Budget and
 * Debts). They rest while an overlay or a shell pane is open, and a letter rests while the focus is in
 * a field, under Ctrl, Alt or Meta, and when the shell takes it, the letter after G included: the same
 * `keyStep` decides, so the two never disagree. Esc reaches the screen from a field too. A handler
 * returns true when it used the key.
 */
export function useScreenKeys(handler: (key: string, event: KeyboardEvent) => boolean | void) {
  const { overlay } = useShell();
  const { pane } = useShellApi();
  const state = useRef<KeyState>(INITIAL_KEY_STATE);
  const latest = useRef({ handler, blocked: false });
  latest.current = { handler, blocked: overlay !== 'none' || pane !== null };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = isTyping(event.target);
      const afterG = state.current.afterG;
      const step = keyStep(state.current, { key: event.key, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey, typing });
      state.current = step.state;
      const { handler: run, blocked } = latest.current;
      if (blocked || event.defaultPrevented) return;
      if (event.key !== 'Escape' && (step.action || afterG || typing || event.ctrlKey || event.metaKey || event.altKey)) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (run(key, event) === true) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
