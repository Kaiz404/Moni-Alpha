import { createNewSession, getActiveSession, type ChatSession } from './messages';

const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;

export function isSessionExpired(session: ChatSession | null): boolean {
  if (!session) return true;
  const idle = Date.now() - new Date(session.lastActiveAt).getTime();
  return idle > SESSION_IDLE_MS;
}

/** Returns active session or starts fresh if idle > 24h. */
export function getOrRefreshSession(): ChatSession {
  const existing = getActiveSession();
  if (!existing || isSessionExpired(existing)) {
    return createNewSession();
  }
  return existing;
}

export function startNewChatSession(): ChatSession {
  return createNewSession();
}
