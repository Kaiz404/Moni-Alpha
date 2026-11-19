import type { AiBackend } from '@repo/ai';

/** The Go gateway's origin. Unset, every AI and Places call goes to the mock instead. */
const AI_API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_AI_API_URL?.trim()) || '';

export const AI_BACKEND_CONFIGURED = AI_API_BASE_URL.length > 0;

/** The phone's way to the gateway: its URL and the token from the MMKV-backed Supabase session. */
export const aiBackend: AiBackend = {
  baseUrl: AI_API_BASE_URL,
  async getAccessToken() {
    try {
      // Loaded on first use, so importing this module does not start the Supabase client.
      const { supabase } = await import('@/lib/supabase/client');
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  },
};
