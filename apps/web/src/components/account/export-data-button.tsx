'use client';

import { useValue } from '@legendapp/state/react';
import { backupTables, buildMoniExport, createCalendar, exportFileName } from '@repo/core';
import { readStoreSnapshot, storeHasPulled } from '@repo/data';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { moniStore } from '@/lib/moni-store';

/** Hands the browser a file to save, as a download from a link it never shows. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export data (issue #70): the phone's Moni export of everything the store holds for the user, as one
 * CSV that Import data restores. It waits for the store's first pull, or the file would miss rows.
 */
export function ExportDataButton({ userId, zone, className = 'btn btn-out press' }: { userId: string; zone: string | null; className?: string }) {
  const ready = useValue(() => storeHasPulled(moniStore()));
  const [failed, setFailed] = useState(false);

  const save = () => {
    try {
      const now = new Date();
      const calendar = createCalendar(zone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
      const tables = backupTables(readStoreSnapshot(moniStore()), userId);
      download(exportFileName(now, calendar), buildMoniExport(tables, userId, now, calendar));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  return (
    <button type="button" className={className} disabled={!ready} aria-busy={!ready} onClick={save} title={failed ? "Couldn't make the CSV. Try again." : undefined}>
      <Icon name="download" size={18} />
      {ready ? (failed ? 'Try again' : 'Export data') : 'Loading your data'}
    </button>
  );
}
