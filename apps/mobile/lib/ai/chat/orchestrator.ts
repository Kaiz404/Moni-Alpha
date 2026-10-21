import { randomUUID } from 'expo-crypto';

import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { AI_UNAVAILABLE_REASON } from '@/lib/ai/client';
import { enqueue, type ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { runExtraction } from '@/lib/ai/run-extraction';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';
import { waitForProposal } from '@/lib/proposals/proposal-wait';
import { saveImageLocally } from '@/lib/receipts/images';
import { enqueueImageUpload } from '@/lib/receipts/upload-queue';
import { getUserId } from '@/lib/supabase/client';

import { analyzeUserFinances } from './analyze';
import { pickAnswerCard } from './answer-cards';
import { buildAnswerSnapshot } from './answer-snapshot';
import { appendMessage, replaceMessage, type ChatMessage, type QuickReplyOption } from './messages';
import { resolveRoute, type ForcedIntent } from './routing';
import { threadDay } from './sessions';

export type SendChatInput = {
  text: string;
  imageUri?: string | null;
  forcedIntent?: ForcedIntent;
};

const CLARIFY_TEXT = 'Did you want to add a transaction or ask about your money?';

/** Raw backend reasons stay in the log; the thread only ever shows these (V2F-States). */
function friendlyFailure(reason: string): string {
  console.warn('[chat] failed:', reason);
  if (reason === AI_UNAVAILABLE_REASON) return "Moni can't answer in this build yet. You can still add spends here.";
  if (/network request failed|failed to fetch|timed? ?out/i.test(reason)) {
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
function startTurn(thinking: string) {
  const createdAt = new Date().toISOString();
  const id = randomUUID();
  const day = threadDay(createdAt);
  appendMessage({ id, role: 'assistant', kind: 'assistant_status', content: thinking, createdAt });
  return {
    finish(next: DistributiveOmit<ChatMessage, 'id' | 'createdAt'>) {
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
type Turn = ReturnType<typeof startTurn>;

/** Writes the message and Moni's turn into today's thread; the chat page listens with subscribeThreads. */
export async function sendChatMessage(input: SendChatInput): Promise<void> {
  const text = input.text.trim();
  const imageUri = input.imageUri ?? null;
  if (!text && !imageUri) return;

  const createdAt = new Date().toISOString();
  appendMessage(
    imageUri
      ? { id: randomUUID(), role: 'user', kind: 'user_image', content: text, imageUri, createdAt }
      : { id: randomUUID(), role: 'user', kind: 'user_text', content: text, createdAt },
  );

  const route = resolveRoute(text, !!imageUri, input.forcedIntent);
  await respond(text, imageUri, route, input.forcedIntent === 'extract');
}

async function respond(
  text: string,
  imageUri: string | null,
  route: ReturnType<typeof resolveRoute>,
  forced = false,
) {
  const turn = startTurn(
    imageUri ? 'Reading your receipt' : route === 'analyze' ? 'Looking at your month' : 'Writing it down',
  );
  try {
    if (imageUri) return await extractImage(imageUri, text, turn);
    if (route === 'analyze') return await answer(text, turn);
    if (route === 'ambiguous')
      return turn.finish({
        role: 'assistant',
        kind: 'assistant_clarify',
        content: CLARIFY_TEXT,
        quickReplies: ['log_transaction', 'analyze_finances'],
        pendingContext: text,
      });
    await extractText(text, turn, !forced);
  } catch (e) {
    turn.fail(e instanceof Error ? e.message : String(e));
  }
}

async function extractImage(imageUri: string, caption: string, turn: Turn) {
  const id = randomUUID();
  const queueItem: ProcessingQueueItem = {
    id,
    type: 'image',
    imageUri: await saveImageLocally(imageUri),
    userContext: caption || undefined,
    createdAt: new Date().toISOString(),
    status: 'pending',
    locationSnapshot: await captureLocationSnapshot(),
  };
  enqueue(queueItem);
  try {
    const userId = await getUserId();
    if (userId && queueItem.imageUri)
      enqueueImageUpload({ target: 'proposal', id, localUri: queueItem.imageUri, userId });
  } catch {
    // The receipt photo uploads later; the draft does not wait for it.
  }
  startBackgroundProcessor().catch(() => {});

  const result = await waitForProposal(id);
  if (result === 'ready')
    turn.finish({ role: 'assistant', kind: 'assistant_draft', proposalId: id });
  else turn.fail(result === 'timeout' ? 'timed out' : 'receipt');
}

async function extractText(text: string, turn: Turn, answerIfSkipped: boolean) {
  const proposalId = randomUUID();
  const result = await runExtraction({
    id: proposalId,
    type: 'text',
    text,
    createdAt: new Date().toISOString(),
    status: 'pending',
    locationSnapshot: await captureLocationSnapshot(),
  });
  if (result.created)
    return turn.finish({
      role: 'assistant',
      kind: 'assistant_draft',
      proposalId: result.proposalId ?? proposalId,
    });
  if (result.skipped && answerIfSkipped) return answer(text, turn);
  if (result.skipped)
    return turn.finish({
      role: 'assistant',
      kind: 'assistant_text',
      content: "Moni couldn't find an amount in that. Try “parking 6 at KLCC”.",
      status: 'error',
    });
  turn.fail(result.reason);
}

/** The card's numbers come from the ledger; the model's reply is its caption. */
async function answer(text: string, turn: Turn) {
  const userId = await getUserId();
  const card = userId ? pickAnswerCard(text, buildAnswerSnapshot(userId)) : null;
  const analysis = await analyzeUserFinances(text);
  if (card)
    return turn.finish({
      role: 'assistant',
      kind: 'assistant_card',
      card,
      content: analysis.ok ? analysis.reply : '',
      analysis: analysis.ok,
    });
  if (analysis.ok)
    return turn.finish({
      role: 'assistant',
      kind: 'assistant_text',
      content: analysis.reply,
      status: 'done',
      analysis: true,
    });
  turn.fail(analysis.reason);
}

/** The clarify chips: run the pinned message the way the user chose. */
export async function handleQuickReply(
  option: QuickReplyOption,
  pendingContext: string,
  pendingImageUri: string | undefined,
): Promise<void> {
  await respond(
    pendingContext,
    pendingImageUri ?? null,
    option === 'log_transaction' ? 'extract' : 'analyze',
    option === 'log_transaction',
  );
}
