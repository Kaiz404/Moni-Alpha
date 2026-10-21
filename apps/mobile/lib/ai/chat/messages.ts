import type { ChatHistoryMessage } from '@repo/types';
import { createMMKV } from 'react-native-mmkv';

import type { IconSymbolName } from '@/components/ui/icon-symbol';

import type { AnswerCard } from './answer-cards';
import { threadDay, todayThreadDay } from './sessions';

const storage = createMMKV({ id: 'moni-chat' });
const LEGACY_SESSION_KEY = 'active_session';
const DAYS_KEY = 'thread_days';
const threadKey = (day: string) => `thread:${day}`;

export type QuickReplyOption = 'log_transaction' | 'analyze_finances';

/** How a draft card was settled; the card keeps showing it after the proposal is gone. */
export type DraftOutcome = {
  kind: 'approved' | 'later' | 'not_mine';
  title: string;
  meta: string;
};

/** One line of the "Moni noticed" card; tapping it asks Moni a question or opens Review. */
export type NoticedItem = {
  title: string;
  meta: string;
  icon: IconSymbolName;
  target: { kind: 'ask'; question: string } | { kind: 'review' };
};

type Base = { id: string; createdAt: string };

export type ChatMessage = Base &
  (
    | { role: 'user'; kind: 'user_text'; content: string }
    | { role: 'user'; kind: 'user_image'; content: string; imageUri: string }
    /** The thinking card while Moni works. */
    | { role: 'assistant'; kind: 'assistant_status'; content: string }
    | {
        role: 'assistant';
        kind: 'assistant_text';
        content: string;
        status: 'done' | 'error';
        /** A /v1/chat/analyze reply: the only assistant turns sent back as history. */
        analysis?: boolean;
      }
    | {
        role: 'assistant';
        kind: 'assistant_clarify';
        content: string;
        quickReplies: QuickReplyOption[];
        pendingContext: string;
        pendingImageUri?: string;
      }
    | { role: 'assistant'; kind: 'assistant_draft'; proposalId: string; outcome?: DraftOutcome }
    /** `content` is the model's caption; empty when the model could not answer. */
    | { role: 'assistant'; kind: 'assistant_card'; card: AnswerCard; content: string; analysis: boolean }
    | { role: 'assistant'; kind: 'assistant_noticed'; items: NoticedItem[] }
  );

export type ChatMessageKind = ChatMessage['kind'];

export type ChatThread = { day: string; messages: ChatMessage[] };

function readJson<T>(key: string): T | null {
  try {
    const raw = storage.getString(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readDays(): string[] {
  return readJson<string[]>(DAYS_KEY) ?? [];
}

const listeners = new Set<(day: string) => void>();

/** Calls `listener` with the day of every thread that changes, including deletes. */
export function subscribeThreads(listener: (day: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writeThread(thread: ChatThread): ChatThread {
  storage.set(threadKey(thread.day), JSON.stringify(thread));
  const days = readDays();
  if (!days.includes(thread.day))
    storage.set(DAYS_KEY, JSON.stringify([...days, thread.day].sort().reverse()));
  listeners.forEach((listener) => listener(thread.day));
  return thread;
}

/** The 24-hour session before one thread per day: split it into days once. */
function migrateLegacySession() {
  const legacy = readJson<{ messages?: ChatMessage[] }>(LEGACY_SESSION_KEY);
  if (!legacy) return;
  for (const message of legacy.messages ?? []) {
    if (message.kind === 'assistant_status') continue;
    const day = threadDay(message.createdAt);
    const thread = readThread(day);
    writeThread({ day, messages: [...thread.messages, message] });
  }
  storage.set(LEGACY_SESSION_KEY, '');
}

export function readThread(day: string): ChatThread {
  return readJson<ChatThread>(threadKey(day)) ?? { day, messages: [] };
}

/** Today's thread; opening chat always lands here. */
export function readTodayThread(now: Date = new Date()): ChatThread {
  migrateLegacySession();
  return readThread(todayThreadDay(now));
}

/** Every stored day, newest first. */
export function listThreads(): ChatThread[] {
  migrateLegacySession();
  return readDays()
    .map(readThread)
    .filter((thread) => thread.messages.length > 0);
}

/** Adds `message` to the thread of the local date it was written on. */
export function appendMessage(message: ChatMessage): ChatThread {
  const day = threadDay(message.createdAt);
  const thread = readThread(day);
  return writeThread({ day, messages: [...thread.messages, message] });
}

/** Swaps one message, found by id, in `day`'s thread for `next`. */
export function replaceMessage(day: string, id: string, next: ChatMessage): ChatThread {
  const thread = readThread(day);
  return writeThread({
    day,
    messages: thread.messages.map((message) => (message.id === id ? next : message)),
  });
}

export function deleteThread(day: string): ChatThread {
  const thread = readThread(day);
  storage.set(threadKey(day), '');
  storage.set(DAYS_KEY, JSON.stringify(readDays().filter((other) => other !== day)));
  listeners.forEach((listener) => listener(day));
  return thread;
}

/** Undo for deleteThread. */
export function restoreThread(thread: ChatThread): void {
  writeThread(thread);
}

function timePrefix(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `[${pad(date.getHours())}:${pad(date.getMinutes())}] `;
}

/**
 * Last N question/answer pairs of today's thread for API context. Only answered analysis replies
 * count, so drafts, cards without a caption, and error text never reach the model; each turn
 * carries its local send time.
 */
export function exportHistoryForApi(maxPairs = 6, now: Date = new Date()): ChatHistoryMessage[] {
  const history: ChatHistoryMessage[] = [];
  let question: ChatMessage | null = null;
  for (const m of readThread(todayThreadDay(now)).messages) {
    if (m.role === 'user') {
      question = m;
      continue;
    }
    const answered =
      (m.kind === 'assistant_text' && m.analysis && m.status === 'done') ||
      (m.kind === 'assistant_card' && m.analysis && m.content.length > 0);
    if (answered && question && 'content' in m) {
      const text = question.content || '[Receipt photo attached]';
      history.push(
        { role: 'user', content: timePrefix(question.createdAt) + text },
        { role: 'assistant', content: timePrefix(m.createdAt) + m.content },
      );
      question = null;
    }
  }
  return history.slice(-maxPairs * 2);
}
