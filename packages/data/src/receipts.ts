import type { MoniSupabase } from './supabase';

/** The bucket a receipt photo lives in, at `<user id>/<capture id>.<ext>`. */
export const RECEIPTS_BUCKET = 'receipts';

/**
 * Where to load a receipt photo from, given what a capture or a transaction stores: a URL as kept,
 * a path in the receipts bucket as its public URL, and nothing for a file still on a phone.
 */
export function receiptPhotoUrl(supabase: Pick<MoniSupabase, 'storage'>, stored: string | null | undefined): string | null {
  const value = stored?.trim();
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(value.replace(/^\/+/, '')).data.publicUrl;
}
