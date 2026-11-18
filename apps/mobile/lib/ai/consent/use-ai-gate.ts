import type { AiUse } from '@repo/types';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { aiUseAllowedNow } from './state';

/**
 * Runs an action that sends something to Moni's AI, or opens the opt-in page first when that use
 * is off. Turned on there, the action runs once the page closes, so the user's tap still counts.
 */
export function useAiGate(use: AiUse): (action: () => void) => void {
  const waiting = useRef<(() => void) | null>(null);

  useFocusEffect(
    useCallback(() => {
      const action = waiting.current;
      if (!action) return;
      waiting.current = null;
      void aiUseAllowedNow(use).then((allowed) => {
        if (allowed) action();
      });
    }, [use]),
  );

  return useCallback(
    (action: () => void) => {
      void aiUseAllowedNow(use).then((allowed) => {
        if (allowed) return action();
        waiting.current = action;
        router.push({ pathname: '/ai-consent', params: { use } });
      });
    },
    [use],
  );
}

/** For a page the user is about to open, such as Scan: the opt-in page goes first and opens it. */
export async function openWithAi(use: 'add' | 'receipts', open: () => void): Promise<void> {
  if (await aiUseAllowedNow(use)) return open();
  router.push({ pathname: '/ai-consent', params: { use, open: '1' } });
}
