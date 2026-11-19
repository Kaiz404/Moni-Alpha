import { AI_CONSENT_REASON } from '@repo/core';
import { aiErrorBodySchema } from '@repo/types';

/** Where the Go gateway lives and how to sign a request to it. Each app hands in its own. */
export type AiBackend = {
  /** The gateway's origin, e.g. `https://ai.example.com`, with no trailing slash. */
  baseUrl: string;
  /** The signed-in user's Supabase access token, or null when signed out. */
  getAccessToken: () => Promise<string | null>;
};

export type Reply = { ok: true; body: unknown } | { ok: false; reason: string };

/** POSTs JSON and never throws: a non-2xx, a network failure and the timeout come back as a reason. */
export async function postJson(
  backend: AiBackend,
  path: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Reply> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);
  const cancel = () => abort.abort();
  signal?.addEventListener('abort', cancel);
  try {
    const token = await backend.getAccessToken();
    const res = await fetch(`${backend.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    const json: unknown = await res.json().catch(() => undefined);
    return res.ok ? { ok: true, body: json } : { ok: false, reason: errorReason(res.status, json) };
  } catch (e) {
    if (abort.signal.aborted) return { ok: false, reason: 'AI backend timed out' };
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

function errorReason(status: number, json: unknown): string {
  const parsed = aiErrorBodySchema.safeParse(json);
  if (!parsed.success) return `AI backend error (${status})`;
  // The token says AI is off: the queue waits for the user instead of retrying.
  if (status === 403 && parsed.data.details?.reason === AI_CONSENT_REASON) return AI_CONSENT_REASON;
  return parsed.data.error;
}
