'use client';

import { useEffect, useRef } from 'react';
import { useShell } from '@/components/shell/shell-store';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * A screen's own keys (P and D on Home; J, K, X and Esc on Activity). Like the shell's, they rest while
 * the focus is in a field, while an overlay is open, and under Ctrl, Alt or Meta. A handler returns true
 * when it used the key.
 */
export function useScreenKeys(handler: (key: string, event: KeyboardEvent) => boolean | void) {
  const { overlay } = useShell();
  const current = useRef(handler);
  current.current = handler;
  useEffect(() => {
    if (overlay !== 'none') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (isTyping(event.target) && event.key !== 'Escape') return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (current.current(key, event) === true) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);
}
