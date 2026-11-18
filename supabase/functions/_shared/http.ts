import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.95.3';

// The web calls these functions from the browser with a bearer token, never a cookie, so any origin may.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function fail(error: string, status: number): Response {
  return json({ error }, status);
}

/** Serves POST with CORS, turning a thrown error into `{ error }` and a 500. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return fail('Use POST', 405);
    try {
      return await handler(req);
    } catch (error) {
      console.error(error);
      return fail(error instanceof Error ? error.message : 'Something went wrong', 500);
    }
  });
}

/** A client holding the project's secret key. It bypasses RLS, so it stays inside the function. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const keys: Record<string, string> = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const secret = keys.default ?? Object.values(keys)[0];
  if (!url || !secret) throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEYS is missing');
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The caller's user id from a verified `Authorization: Bearer` access token, or null. */
export async function callerId(admin: SupabaseClient, req: Request): Promise<string | null> {
  const token = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return null;
  // Checked against the project's signing keys, so it still works once the user row is gone.
  const { data, error } = await admin.auth.getClaims(token);
  if (error || !data || data.claims.role !== 'authenticated') return null;
  return data.claims.sub;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body !== null && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
