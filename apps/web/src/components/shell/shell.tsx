'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/components/use-theme';
import { INITIAL_KEY_STATE, keyStep, type KeyState } from '@/lib/keys';
import { navItem } from '@/lib/nav';
import { CommandPalette } from './command-palette';
import { Rail, Sidebar, TabBar } from './nav-bars';
import { AccountMenu, ShortcutsDialog, Toaster } from './overlays';
import { ChatPane } from '@/components/chat/chat-pane';
import { AddPane } from './panes';
import { ShellContext, type Pane, type ShellAction, type ShellApi, type ShellUser } from './shell-context';
import { setShell, showToast, signOut, undoToast, useShell } from './shell-store';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function parsePane(value: string | null): Pane {
  return value === 'chat' || value === 'add' ? value : null;
}

/**
 * The app shell: one tree for every layout. The sidebar, rail and tab bar are all rendered and CSS shows
 * the one the viewport picks, so crossing a breakpoint never remounts the page or a half-typed field.
 * The route and `?pane=` say where you are; the shell store holds drafts and the open overlay.
 */
export function Shell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pane = parsePane(searchParams.get('pane'));
  const { overlay } = useShell();
  const { pref, setTheme } = useTheme();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const keys = useRef<KeyState>(INITIAL_KEY_STATE);
  const returnFocus = useRef<HTMLElement | null>(null);

  const setPane = useCallback(
    (next: Pane) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set('pane', next);
      else params.delete('pane');
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const hrefWithPane = useCallback((href: string) => (pane === 'chat' ? `${href}?pane=chat` : href), [pane]);

  const openOverlay = useCallback((next: 'palette' | 'shortcuts' | 'account') => {
    if (document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
    setShell({ overlay: next });
  }, []);

  const closeOverlay = useCallback(() => {
    setShell({ overlay: 'none' });
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  const run = useCallback(
    (action: ShellAction, origin?: HTMLElement | null) => {
      switch (action.kind) {
        case 'palette':
          return overlay === 'palette' ? closeOverlay() : openOverlay('palette');
        case 'shortcuts':
          return openOverlay('shortcuts');
        case 'account':
          setAnchor(origin?.getBoundingClientRect() ?? null);
          return overlay === 'account' ? closeOverlay() : openOverlay('account');
        case 'close':
          if (overlay !== 'none') return closeOverlay();
          if (pane) return setPane(null);
          return;
        case 'closePane':
          return setPane(null);
        case 'ask':
          setShell({ overlay: 'none' });
          return setPane(pane === 'chat' && overlay !== 'palette' ? null : 'chat');
        case 'add':
          setShell({ overlay: 'none' });
          return setPane('add');
        case 'go': {
          setShell({ overlay: 'none' });
          const href = navItem(action.to).href;
          return router.push(pane === 'chat' ? `${href}?pane=chat` : href);
        }
        case 'theme': {
          setShell({ overlay: 'none' });
          const before = pref;
          setTheme(action.theme);
          return showToast({
            text: action.theme === 'dark' ? 'Dark theme on' : 'Light theme on',
            tone: 'done',
            undo: () => setTheme(before),
          });
        }
        case 'undo':
          undoToast();
          return;
        case 'signOut':
          void signOut().then(() => {
            router.replace('/login');
            router.refresh();
          });
          return;
      }
    },
    [closeOverlay, openOverlay, overlay, pane, pref, router, setPane, setTheme],
  );

  useEffect(() => {
    // The keys work from here on; the verify script waits for this before pressing any.
    document.documentElement.dataset.shellReady = 'true';
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const step = keyStep(keys.current, {
        key: event.key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        typing: isTyping(event.target),
      });
      keys.current = step.state;
      if (!step.action) return;
      if (step.action.kind === 'close' && overlay === 'none' && !pane) return;
      event.preventDefault();
      run(step.action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, pane, run]);

  const api: ShellApi = useMemo(() => ({ user, pane, run, hrefWithPane }), [user, pane, run, hrefWithPane]);

  return (
    <ShellContext.Provider value={api}>
      <div className="shell" data-pane={pane ?? undefined}>
        <Sidebar />
        <Rail />
        <main className="shell-main">
          <div key={pathname.split('/')[1]} className="page-enter">
            {children}
          </div>
        </main>
        <TabBar />
        {pane === 'chat' && <ChatPane />}
        {pane === 'add' && (
          <>
            <div className="scrim scrim-pane" data-only="sidebar rail rail-one-column" onMouseDown={() => setPane(null)} />
            <AddPane />
          </>
        )}
        {pane === 'chat' && (
          <div className="scrim scrim-pane" data-only="rail-one-column" onMouseDown={() => setPane(null)} />
        )}
        {overlay === 'palette' && <CommandPalette />}
        {overlay === 'shortcuts' && <ShortcutsDialog />}
        {overlay === 'account' && <AccountMenu anchor={anchor} />}
        <Toaster />
      </div>
    </ShellContext.Provider>
  );
}
