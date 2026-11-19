'use client';

import { syncState, when } from '@legendapp/state';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { showToast } from '@/components/shell/shell-store';
import { Glyph } from '@/components/ledger/glyph';
import { clockTime } from '@/lib/ledger/format';
import { moniStore } from '@/lib/moni-store';
import './states.css';

/** When the tab last had the network: the numbers on screen are as of then. */
let offlineSince: string | null = null;

function subscribe(listener: () => void) {
  const offline = () => {
    offlineSince = new Date().toISOString();
    listener();
  };
  window.addEventListener('offline', offline);
  window.addEventListener('online', listener);
  return () => {
    window.removeEventListener('offline', offline);
    window.removeEventListener('online', listener);
  };
}

/** True while the browser has a network; the server render and the first paint count as online. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Rows written in this tab that the server hasn't taken yet, across every synced table. */
function pendingWrites(): number {
  return moniStore().all.reduce((sum, table$) => sum + (syncState(table$).numPendingSets.get() ?? 0), 0);
}

/** Resolves once every row this tab wrote has reached the server. */
export function whenSynced(): Promise<unknown> {
  return when(() => pendingWrites() === 0);
}

/**
 * Back online: once the rows saved offline reach the server, an info toast says how many synced
 * (W2-States, Connection). Legend's sync queues the writes; this only watches it drain.
 */
export function useReconnectToast() {
  const online = useOnline();
  const was = useRef(online);
  useEffect(() => {
    if (online === was.current) return;
    was.current = online;
    if (!online) return;
    const waiting = pendingWrites();
    void Promise.race([when(() => pendingWrites() === 0), new Promise((resolve) => setTimeout(resolve, 15_000))]).then(() => {
      const left = pendingWrites();
      const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`);
      if (left > 0) showToast({ text: `Couldn't sync ${changes(left)}. It's safe in this tab.`, tone: 'error', retry: () => void moniStore().enableStoreSync() });
      else showToast({ text: waiting > 0 ? `Back online · ${changes(waiting)} synced` : 'Back online', tone: 'info' });
    });
  }, [online]);
}

/** The Sand banner under the page header while offline: what still works, what waits, how fresh the numbers are. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="offline-banner">
      <span className="offline-icon">
        <Glyph name="cloud-off-outline" size={20} />
      </span>
      <span className="offline-text">
        <b>You&apos;re offline.</b>
        <span>New spends and edits save in this tab and sync when you&apos;re back. Moni chat, Review and Import wait for a connection. Keep this tab open.</span>
      </span>
      {offlineSince && <span className="num offline-time">Updated {clockTime(offlineSince, Intl.DateTimeFormat().resolvedOptions().timeZone)}</span>}
    </div>
  );
}
