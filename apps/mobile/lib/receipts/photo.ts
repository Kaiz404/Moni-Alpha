import { receiptPath } from '@repo/core';
import { receiptPhotos } from '@repo/data';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

/** A signed link to a stored receipt photo, kept until shortly before it expires. */
export const receiptPhoto = receiptPhotos(supabase);

/** The link to show a stored receipt photo: undefined while it is being signed, null when there is none. */
export function useReceiptPhoto(stored: string | null): string | null | undefined {
  const [signed, setSigned] = useState<{ stored: string | null; url: string | null }>();
  const uploaded = receiptPath(stored) !== null;
  useEffect(() => {
    if (!uploaded) return;
    let live = true;
    void receiptPhoto(stored).then((url) => {
      if (live) setSigned({ stored, url });
    });
    return () => {
      live = false;
    };
  }, [stored, uploaded]);
  if (!uploaded) return null;
  return signed?.stored === stored ? signed.url : undefined;
}
