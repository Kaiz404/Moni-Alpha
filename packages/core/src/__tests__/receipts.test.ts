import { describe, expect, it } from 'vitest';

import { receiptPath } from '../receipts';

describe('receiptPath', () => {
  it('reads the bucket path from a stored path or a public URL, and has none for a photo not uploaded', () => {
    expect(
      [
        'u-1/p-1.jpg',
        'https://dev.supabase.co/storage/v1/object/public/receipts/u-1/p-2.png',
        'https://cdn.test/photos/u-1/p-3.jpg',
        'file:///data/user/0/receipts/p-4.jpg',
        '  ',
        null,
      ].map(receiptPath),
    ).toEqual(['u-1/p-1.jpg', 'u-1/p-2.png', null, null, null, null]);
  });
});
