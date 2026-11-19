import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { receiptPhotoUrl } from '../receipts';

const supabase = createClient('https://dev.supabase.co', 'sb_publishable_test', { auth: { persistSession: false } });

describe('receiptPhotoUrl', () => {
  it('keeps a stored URL, makes a bucket path public, and has nothing for a file on a phone', () => {
    expect(
      [
        'https://dev.supabase.co/storage/v1/object/public/receipts/u-1/p-1.jpg',
        'u-1/p-1.jpg',
        '/u-1/p-2.png',
        'file:///data/user/0/receipts/p-1.jpg',
        '  ',
        null,
      ].map((stored) => receiptPhotoUrl(supabase, stored)),
    ).toEqual([
      'https://dev.supabase.co/storage/v1/object/public/receipts/u-1/p-1.jpg',
      'https://dev.supabase.co/storage/v1/object/public/receipts/u-1/p-1.jpg',
      'https://dev.supabase.co/storage/v1/object/public/receipts/u-1/p-2.png',
      null,
      null,
      null,
    ]);
  });
});
