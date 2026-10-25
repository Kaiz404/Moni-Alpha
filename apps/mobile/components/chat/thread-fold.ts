import type { ChatMessage } from '@/lib/ai/chat/messages';

/** V2H-MoniPlacement: today's thread folds once it has sat this long without a word. */
export const FOLD_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * How many of today's messages hide under "Earlier today" when chat opens: all of them after two
 * idle hours, none while a draft still waits for a decision or Moni is still replying.
 */
export function foldedOnReopen(
  messages: readonly ChatMessage[],
  pendingProposalIds: ReadonlySet<string>,
  now: Date,
): number {
  const last = messages.at(-1);
  if (!last || now.getTime() - Date.parse(last.createdAt) < FOLD_AFTER_MS) return 0;
  const busy = messages.some(
    (message) =>
      message.kind === 'assistant_status' ||
      (message.kind === 'assistant_draft' &&
        !message.outcome &&
        pendingProposalIds.has(message.proposalId)),
  );
  return busy ? 0 : messages.length;
}
