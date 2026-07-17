import { randomUUID } from 'expo-crypto';

import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { enqueue, type ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { runExtraction } from '@/lib/ai/run-extraction';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';
import { saveImageLocally } from '@/lib/receipts/images';
import { enqueueImageUpload } from '@/lib/receipts/upload-queue';
import { getUserId } from '@/lib/supabase/client';
import {
  beginImmediateProposalReview,
  clearImmediateProposalReview,
  completeImmediateProposalReview,
} from '@/lib/proposals/immediate-review';
import { waitForProposal } from '@/lib/proposals/proposal-wait';

import { analyzeUserFinances } from './analyze';
import { appendMessage, updateMessage, type ChatMessage, type QuickReplyOption } from './messages';
import { resolveRoute, type ForcedIntent } from './routing';

export type SendChatInput = {
  text: string;
  imageUri?: string | null;
  forcedIntent?: ForcedIntent;
  /** When clarifying, the original user message */
  pendingContext?: string;
  pendingImageUri?: string;
};

export type ChatSessionSnapshot = {
  messages: ChatMessage[];
};

export type SendChatCallbacks = {
  onSessionUpdate: (session: ChatSessionSnapshot) => void;
};

const EXTRACT_ACK = "Got it — I'll let you know when it's ready to review.";
const EXTRACT_ACK_PROCESSING = 'Processing your transaction…';
const IMAGE_ACK = 'Got it — processing your receipt. Review when ready.';
const CLARIFY_TEXT = 'Did you want to log a transaction or ask about your finances?';

function emit(cb: SendChatCallbacks, messages: ChatMessage[]) {
  cb.onSessionUpdate({ messages });
}

export async function sendChatMessage(
  input: SendChatInput,
  callbacks: SendChatCallbacks,
): Promise<void> {
  const text = (input.pendingContext ?? input.text).trim();
  const imageUri = input.pendingImageUri ?? input.imageUri ?? null;
  if (!text && !imageUri) return;

  const userMessage: ChatMessage = {
    id: randomUUID(),
    role: 'user',
    kind: imageUri ? 'user_image' : 'user_text',
    content: text || (imageUri ? 'Receipt photo' : ''),
    imageUri: imageUri ?? undefined,
    createdAt: new Date().toISOString(),
  };

  let session = appendMessage(userMessage);
  emit(callbacks, session.messages);

  const statusId = randomUUID();
  const statusMessage: ChatMessage = {
    id: statusId,
    role: 'assistant',
    kind: 'assistant_status',
    content: imageUri ? 'Processing your receipt…' : EXTRACT_ACK_PROCESSING,
    createdAt: new Date().toISOString(),
    status: 'processing',
  };
  session = appendMessage(statusMessage);
  emit(callbacks, session.messages);

  const route = resolveRoute(text, !!imageUri, input.forcedIntent);

  try {
    if (imageUri) {
      await handleImageExtract(imageUri, text, statusId, callbacks);
      return;
    }

    if (route === 'analyze') {
      await handleAnalyze(text, statusId, callbacks);
      return;
    }

    if (route === 'ambiguous' && !input.forcedIntent) {
      await showClarify(statusId, text, imageUri, callbacks);
      return;
    }

    await handleTextExtract(text, statusId, callbacks, input.forcedIntent === 'analyze');
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Something went wrong';
    session = updateMessage(statusId, {
      kind: 'assistant_text',
      content: reason,
      status: 'error',
    });
    emit(callbacks, session.messages);
  }
}

async function handleImageExtract(
  imageUri: string,
  caption: string,
  statusId: string,
  callbacks: SendChatCallbacks,
) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const locationSnapshot = await captureLocationSnapshot();
  const localUri = await saveImageLocally(imageUri);

  const queueItem: ProcessingQueueItem = {
    id,
    type: 'image',
    imageUri: localUri,
    userContext: caption || undefined,
    createdAt,
    status: 'pending',
    locationSnapshot,
  };
  enqueue(queueItem);

  beginImmediateProposalReview(id, {
    title: 'Reading your receipt…',
    detail: 'Moni will show every detail before saving anything.',
    icon: 'receipt',
  });

  try {
    const userId = await getUserId();
    if (userId) {
      enqueueImageUpload({ proposalId: id, localUri, userId });
    }
  } catch {
    // non-critical
  }

  startBackgroundProcessor().catch(() => {});

  void waitForProposal(id).then((result) => {
    if (result === 'ready') {
      completeImmediateProposalReview(id);
      return;
    }
    clearImmediateProposalReview(id);
  });

  const session = updateMessage(statusId, {
    kind: 'assistant_text',
    content: IMAGE_ACK,
    status: 'done',
  });
  emit(callbacks, session.messages);
}

async function handleTextExtract(
  text: string,
  statusId: string,
  callbacks: SendChatCallbacks,
  skipFallback = false,
) {
  const locationSnapshot = await captureLocationSnapshot();
  const proposalId = randomUUID();
  const queueItem: ProcessingQueueItem = {
    id: proposalId,
    type: 'text',
    text,
    createdAt: new Date().toISOString(),
    status: 'pending',
    locationSnapshot,
  };

  beginImmediateProposalReview(proposalId, {
    title: 'Preparing your review…',
    detail: 'Moni is checking the details you provided.',
    icon: 'chat',
  });

  const result = await runExtraction(queueItem);

  if (result.created) {
    completeImmediateProposalReview(result.proposalId ?? proposalId);
    const session = updateMessage(statusId, {
      kind: 'assistant_text',
      content: EXTRACT_ACK,
      status: 'done',
    });
    emit(callbacks, session.messages);
    return;
  }

  if (!skipFallback && result.skipped) {
    clearImmediateProposalReview(proposalId);
    await handleAnalyze(text, statusId, callbacks, true);
    return;
  }

  if (result.skipped) {
    clearImmediateProposalReview(proposalId);
    await showClarify(statusId, text, null, callbacks);
    return;
  }

  const session = updateMessage(statusId, {
    kind: 'assistant_text',
    content: result.reason || 'Could not process that message.',
    status: 'error',
  });
  clearImmediateProposalReview(proposalId);
  emit(callbacks, session.messages);
}

async function handleAnalyze(
  text: string,
  statusId: string,
  callbacks: SendChatCallbacks,
  afterExtractSkip = false,
) {
  const analysis = await analyzeUserFinances(text);

  if (analysis.ok) {
    const session = updateMessage(statusId, {
      kind: 'assistant_text',
      content: analysis.reply,
      status: 'done',
    });
    emit(callbacks, session.messages);
    return;
  }

  if (afterExtractSkip) {
    await showClarify(statusId, text, null, callbacks);
    return;
  }

  const session = updateMessage(statusId, {
    kind: 'assistant_text',
    content: analysis.reason,
    status: 'error',
  });
  emit(callbacks, session.messages);
}

async function showClarify(
  statusId: string,
  text: string,
  imageUri: string | null,
  callbacks: SendChatCallbacks,
) {
  const quickReplies: QuickReplyOption[] = ['log_transaction', 'analyze_finances'];
  const session = updateMessage(statusId, {
    kind: 'assistant_clarify',
    content: CLARIFY_TEXT,
    quickReplies,
    pendingContext: text,
    pendingImageUri: imageUri ?? undefined,
    status: 'done',
  });
  emit(callbacks, session.messages);
}

export async function handleQuickReply(
  option: QuickReplyOption,
  pendingContext: string,
  pendingImageUri: string | undefined,
  callbacks: SendChatCallbacks,
): Promise<void> {
  const statusId = randomUUID();
  let session = appendMessage({
    id: statusId,
    role: 'assistant',
    kind: 'assistant_status',
    content: EXTRACT_ACK_PROCESSING,
    createdAt: new Date().toISOString(),
    status: 'processing',
  });
  emit(callbacks, session.messages);

  if (option === 'log_transaction') {
    if (pendingImageUri) {
      await handleImageExtract(pendingImageUri, pendingContext, statusId, callbacks);
    } else {
      await handleTextExtract(pendingContext, statusId, callbacks, true);
    }
    return;
  }

  await handleAnalyze(pendingContext, statusId, callbacks);
}
