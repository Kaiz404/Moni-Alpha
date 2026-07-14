import { createMMKV } from 'react-native-mmkv';
import type { ChatHistoryMessage } from '@repo/types';

const storage = createMMKV({ id: 'moni-chat' });
const SESSION_KEY = 'active_session';

export type ChatMessageKind =
  | 'user_text'
  | 'user_image'
  | 'assistant_text'
  | 'assistant_status'
  | 'assistant_clarify';

export type QuickReplyOption = 'log_transaction' | 'analyze_finances';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  kind: ChatMessageKind;
  content: string;
  imageUri?: string;
  createdAt: string;
  /** For clarify messages — tappable chips */
  quickReplies?: QuickReplyOption[];
  /** Pinned user message when clarifying */
  pendingContext?: string;
  pendingImageUri?: string;
  status?: 'processing' | 'done' | 'error';
};

export type ChatSession = {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  messages: ChatMessage[];
};

function readSession(): ChatSession | null {
  try {
    const raw = storage.getString(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ChatSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: ChatSession) {
  storage.set(SESSION_KEY, JSON.stringify(session));
}

export function getActiveSession(): ChatSession | null {
  return readSession();
}

export function createNewSession(): ChatSession {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: now,
    createdAt: now,
    lastActiveAt: now,
    messages: [],
  };
  writeSession(session);
  return session;
}

export function ensureActiveSession(): ChatSession {
  const existing = readSession();
  if (existing) return existing;
  return createNewSession();
}

export function touchSession(session: ChatSession): ChatSession {
  const updated = { ...session, lastActiveAt: new Date().toISOString() };
  writeSession(updated);
  return updated;
}

export function appendMessage(message: ChatMessage): ChatSession {
  const session = ensureActiveSession();
  const updated: ChatSession = {
    ...session,
    lastActiveAt: new Date().toISOString(),
    messages: [...session.messages, message],
  };
  writeSession(updated);
  return updated;
}

export function updateMessage(
  messageId: string,
  patch: Partial<ChatMessage>,
): ChatSession {
  const session = ensureActiveSession();
  const updated: ChatSession = {
    ...session,
    lastActiveAt: new Date().toISOString(),
    messages: session.messages.map((m) =>
      m.id === messageId ? { ...m, ...patch } : m,
    ),
  };
  writeSession(updated);
  return updated;
}

export function replaceSessionMessages(messages: ChatMessage[]): ChatSession {
  const session = ensureActiveSession();
  const updated: ChatSession = {
    ...session,
    lastActiveAt: new Date().toISOString(),
    messages,
  };
  writeSession(updated);
  return updated;
}

/** Last N user/assistant pairs for API context (rolling window). */
export function exportHistoryForApi(maxPairs = 6): ChatHistoryMessage[] {
  const session = readSession();
  if (!session) return [];

  const eligible = session.messages.filter(
    (m) =>
      m.kind === 'user_text' ||
      m.kind === 'user_image' ||
      m.kind === 'assistant_text',
  );

  const history: ChatHistoryMessage[] = [];
  for (const m of eligible) {
    if (m.kind === 'user_text' || m.kind === 'user_image') {
      const text =
        m.kind === 'user_image'
          ? m.content || '[Receipt photo attached]'
          : m.content;
      history.push({ role: 'user', content: text });
    } else if (m.kind === 'assistant_text') {
      history.push({ role: 'assistant', content: m.content });
    }
  }

  const maxMessages = maxPairs * 2;
  return history.slice(-maxMessages);
}
