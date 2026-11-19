import { receiptPath } from '@repo/core';

import type { MoniSupabase } from './supabase';

const RECEIPTS_BUCKET = 'receipts';
/** How long a signed photo link works. */
const SIGNED_SECONDS = 60 * 60;
/** A link this close to expiring is signed again, so a screen never gets one that dies while it is open. */
const RENEW_MS = 5 * 60 * 1000;

/** A signed link to a stored receipt photo, or null when there is none to show: not uploaded yet, or the signing failed. */
export type ReceiptPhotos = (stored: string | null | undefined) => Promise<string | null>;

type Signed = { url: Promise<string | null>; expiresAt: number };

/**
 * Reads receipt photos from the private `receipts` bucket, where storage policies let a user read only
 * their own `{uid}/` folder. Takes what a capture or transaction stores (see `receiptPath`) and keeps
 * each signed link until shortly before it expires; one reader per client.
 */
export function receiptPhotos(supabase: Pick<MoniSupabase, 'storage'>, now: () => number = Date.now): ReceiptPhotos {
  const signed = new Map<string, Signed>();

  async function sign(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, SIGNED_SECONDS);
    return error ? null : data.signedUrl;
  }

  return (stored) => {
    const path = receiptPath(stored);
    if (!path) return Promise.resolve(null);
    const cached = signed.get(path);
    if (cached && now() < cached.expiresAt - RENEW_MS) return cached.url;
    const entry: Signed = { url: sign(path), expiresAt: now() + SIGNED_SECONDS * 1000 };
    signed.set(path, entry);
    void entry.url.then((url) => {
      if (url === null && signed.get(path) === entry) signed.delete(path);
    });
    return entry.url;
  };
}
