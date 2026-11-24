import { receiptPath } from '@repo/core';
import { receiptPhotos, type ReceiptPhotos } from '@repo/data';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

let photos: ReceiptPhotos | null = null;

/** A signed link to a stored receipt photo in the private `receipts` bucket, or null when there is none. */
export function signReceiptPhoto(stored: string | null): Promise<string | null> {
  photos ??= receiptPhotos(createClient());
  return photos(stored);
}

type Signed = { stored: string | null; url: string | null };

/**
 * What a screen shows for a stored receipt photo, given the last link signed: null when nothing is uploaded
 * (no photo, or a file still on the phone), undefined while this value's link is being signed, else the link.
 */
export function shownPhoto(stored: string | null, signed: Signed | undefined): string | null | undefined {
  if (receiptPath(stored) === null) return null;
  return signed?.stored === stored ? signed.url : undefined;
}

/** The link to show a stored receipt photo: undefined while it is being signed, null when there is none. */
export function useReceiptPhoto(stored: string | null): string | null | undefined {
  const [signed, setSigned] = useState<Signed>();
  const uploaded = receiptPath(stored) !== null;
  useEffect(() => {
    if (!uploaded) return;
    let live = true;
    void signReceiptPhoto(stored).then((url) => {
      if (live) setSigned({ stored, url });
    });
    return () => {
      live = false;
    };
  }, [stored, uploaded]);
  return shownPhoto(stored, signed);
}
