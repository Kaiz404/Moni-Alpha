/**
 * Real HTTP AI client for the Go backend (apps/backend).
 * Active when EXPO_PUBLIC_AI_API_URL is set.
 */
import { AI_API_BASE_URL, AI_BACKEND_CONFIGURED, AI_UNAVAILABLE_REASON } from './config';
import { buildImagePayload } from './image-payload';
import type {
  AiClient,
  ChatAnalyzeRequest,
  ChatAnalyzeResult,
  ExtractImageRequest,
  ExtractImageWireRequest,
  ExtractNotificationRequest,
  ExtractResult,
  ExtractTextRequest,
} from './types';

const REQUEST_TIMEOUT_MS = 100_000;

export async function getAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabase/client');
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!AI_BACKEND_CONFIGURED) {
    throw new Error(AI_UNAVAILABLE_REASON);
  }

  const token = await getAccessToken();
  // React Native's fetch has no timeout of its own, and a black-holed host would hold the
  // processor forever. This sits past the backend's 90s write timeout.
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });

    if (!res.ok) {
      let message = `AI backend error (${res.status})`;
      try {
        const err = await res.json();
        if (err?.error) message = String(err.error);
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return (await res.json()) as T;
  } catch (e) {
    throw abort.signal.aborted ? new Error('AI backend timed out') : e;
  } finally {
    clearTimeout(timeout);
  }
}

function asExtractResult(data: unknown): ExtractResult {
  if (data && typeof data === 'object' && 'status' in data && (data as ExtractResult).status) {
    return data as ExtractResult;
  }
  return {
    status: 'unavailable',
    reason: 'Unexpected AI backend response',
  };
}

export const httpAiClient: AiClient = {
  async extractFromText(req: ExtractTextRequest): Promise<ExtractResult> {
    try {
      return asExtractResult(await postJson('/v1/extract/text', req));
    } catch (e) {
      return {
        status: 'unavailable',
        reason: e instanceof Error ? e.message : AI_UNAVAILABLE_REASON,
      };
    }
  },

  async extractFromImage(req: ExtractImageRequest): Promise<ExtractResult> {
    try {
      const payload = await buildImagePayload(req.imageUri);
      if (!payload) {
        return {
          status: 'skipped',
          reason: 'Could not read the receipt image',
        };
      }
      const wireReq: ExtractImageWireRequest = { ...req, ...payload };
      return asExtractResult(await postJson('/v1/extract/image', wireReq));
    } catch (e) {
      return {
        status: 'unavailable',
        reason: e instanceof Error ? e.message : AI_UNAVAILABLE_REASON,
      };
    }
  },

  async extractFromNotification(req: ExtractNotificationRequest): Promise<ExtractResult> {
    try {
      return asExtractResult(await postJson('/v1/extract/notification', req));
    } catch (e) {
      return {
        status: 'unavailable',
        reason: e instanceof Error ? e.message : AI_UNAVAILABLE_REASON,
      };
    }
  },

  async analyzeFinances(req: ChatAnalyzeRequest): Promise<ChatAnalyzeResult> {
    try {
      const data = await postJson<ChatAnalyzeResult>('/v1/chat/analyze', req);
      if (data?.status === 'ok' || data?.status === 'unavailable') return data;
      return {
        status: 'unavailable',
        reason: 'Unexpected AI backend response',
      };
    } catch (e) {
      return {
        status: 'unavailable',
        reason: e instanceof Error ? e.message : AI_UNAVAILABLE_REASON,
      };
    }
  },
};
