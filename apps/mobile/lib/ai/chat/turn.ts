import { randomUUID } from 'expo-crypto';

import { AI_UNAVAILABLE_REASON } from '@/lib/ai/client/mock';
import { AI_CONSENT_REASON } from '@repo/core';

import { markFresh } from './fresh-replies';
import { appendMessage, replaceMessage, type ChatMessage } from './messages';
import { threadDay } from './sessions';

/** Raw backend reasons stay in the log; the thread only ever shows these (V2F-States). */
export function friendlyFailure(reason: string): string {
  console.warn('[chat] failed:', reason);
  if (reason === AI_UNAVAILABLE_REASON) return "Moni can't answer in this build yet. You can still add spends here.";
  if (reason === AI_CONSENT_REASON) return "Moni's AI is off for chat. Turn it on in Profile › Moni's AI.";
  if (/network request failed|failed to fetch|timed? ?out|keys are not loaded|backend error \(5\d\d\)/i.test(reason)) {
    return "Moni can't answer right now. Check your connection and try again.";
  }
  if (/rate limit|too many/i.test(reason)) {
    return 'Moni is busy right now. Try again in a minute.';
  }
  if (/not authenticated|invalid or expired token|missing bearer/i.test(reason)) {
    return 'Sign in again, then try once more.';
  }
  return "Moni couldn't answer that. Try asking another way.";
}

/** One assistant turn: starts as the thinking card and is replaced in place by its result. */
export function startTurn(thinking: string) {
  const createdAt = new Date().toISOString();
  const id = randomUUID();
  const day = threadDay(createdAt);
  appendMessage({ id, role: 'assistant', kind: 'assistant_status', content: thinking, createdAt });
  return {
    finish(next: DistributiveOmit<ChatMessage, 'id' | 'createdAt'>) {
      markFresh(id);
      replaceMessage(day, id, { ...next, id, createdAt } as ChatMessage);
    },
    fail(reason: string) {
      this.finish({
        role: 'assistant',
        kind: 'assistant_text',
        content: friendlyFailure(reason),
        status: 'error',
      });
    },
  };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type Turn = ReturnType<typeof startTurn>;
