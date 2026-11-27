import { randomUUID } from 'expo-crypto';

import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import {
  AI_CONSENT_REASON,
  pickAnswerCard,
  resolveRoute,
  type ForcedIntent,
} from '@repo/core';
import { enqueue, type ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { runExtraction } from '@/lib/ai/run-extraction';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';
import { waitForProposal } from '@/lib/proposals/proposal-wait';
import { saveImageLocally } from '@/lib/receipts/images';
import { enqueueImageUpload } from '@/lib/receipts/upload-queue';
import { getUserId } from '@/lib/supabase/client';

import { analyzeUserFinances } from './analyze';
import { peekAnswerSnapshot } from './answer-snapshot';
import { answerBudgetStep, openBudgetStep } from './budget-ask';
import { appendMessage, readTodayThread, type QuickReplyOption } from './messages';
import { startTurn, type Turn } from './turn';

export type SendChatInput = {
  text: string;
  imageUri?: string | null;
  forcedIntent?: ForcedIntent;
};

const CLARIFY_TEXT = 'Did you want to add a transaction or ask about your money?';


/**
 * Writes the message and Moni's turn into today's thread; the chat page listens with subscribeThreads.
 * While a budget question waits, typed words answer it.
 */
export async function sendChatMessage(input: SendChatInput): Promise<void> {
  const text = input.text.trim();
  const imageUri = input.imageUri ?? null;
  if (!text && !imageUri) return;
  const step = imageUri ? null : openBudgetStep(readTodayThread().messages);
  if (step) return answerBudgetStep(step, text);

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
    use: 'chat',
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
  else if (result === 'retrying')
    turn.finish({
      role: 'assistant',
      kind: 'assistant_text',
      content: "Moni can't read this receipt right now. It's safe on this phone and goes to Review once Moni reads it.",
      status: 'error',
    });
  else if (result === 'needs_ai') turn.fail(AI_CONSENT_REASON);
  else turn.fail(result === 'timeout' ? 'timed out' : 'receipt');
}

async function extractText(text: string, turn: Turn, answerIfSkipped: boolean) {
  const proposalId = randomUUID();
  const result = await runExtraction({
    id: proposalId,
    type: 'text',
    use: 'chat',
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
  if (answerIfSkipped) return answer(text, turn);
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
  const card = userId ? pickAnswerCard(text, peekAnswerSnapshot(userId)) : null;
  if (card?.kind === 'captures')
    return turn.finish({ role: 'assistant', kind: 'assistant_card', card, content: '', analysis: false });
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
