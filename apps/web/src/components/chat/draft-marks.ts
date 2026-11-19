'use client';

import { useMemo } from 'react';
import { useShellApi } from '@/components/shell/shell-context';
import { useShell } from '@/components/shell/shell-store';

/**
 * While Moni chat is open, the rows an open draft would change, by id, with the category each would
 * move to.
 */
export function useDraftMarks(): ReadonlyMap<string, string> {
  const { chat } = useShell();
  const { pane } = useShellApi();
  return useMemo(() => {
    const marks = new Map<string, string>();
    if (pane !== 'chat') return marks;
    for (const message of chat)
      if (message.role === 'moni' && message.kind === 'draft' && message.state.phase === 'open')
        for (const row of message.draft.rows) marks.set(row.id, message.draft.to.id);
    return marks;
  }, [chat, pane]);
}
