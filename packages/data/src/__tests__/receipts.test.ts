import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { receiptPhotos } from '../receipts';

/** Storage behind a real client: each sign request is recorded, and `refuse` answers as RLS does for someone else's photo. */
function fakeStorage(refuse: string[] = []) {
  const signs: string[] = [];
  let token = 0;
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    signs.push(`${init?.method} ${url} ${String(init?.body)}`);
    const path = url.replace('https://dev.supabase.co/storage/v1/object/sign/receipts/', '');
    if (refuse.includes(path)) {
      return new Response(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }), { status: 400 });
    }
    token += 1;
    return new Response(JSON.stringify({ signedURL: `/object/sign/receipts/${path}?token=t${token}` }), { status: 200 });
  };
  const supabase = createClient('https://dev.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false },
    global: { fetch },
  });
  return { supabase, signs };
}

describe('receiptPhotos', () => {
  it('signs a stored path, and the path inside a public URL stored before the bucket went private, for an hour', async () => {
    const { supabase, signs } = fakeStorage();
    const photo = receiptPhotos(supabase, () => 0);

    expect(await photo('u-1/p-1.jpg')).toBe('https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg?token=t1');
    expect(await photo('https://dev.supabase.co/storage/v1/object/public/receipts/u-1/p-2.png')).toBe(
      'https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-2.png?token=t2',
    );
    expect(signs).toEqual([
      'POST https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg {"expiresIn":3600}',
      'POST https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-2.png {"expiresIn":3600}',
    ]);
  });

  it('asks storage nothing for a photo not uploaded yet', async () => {
    const { supabase, signs } = fakeStorage();
    const photo = receiptPhotos(supabase, () => 0);

    expect([await photo('file:///data/user/0/receipts/p-1.jpg'), await photo('  '), await photo(null)]).toEqual([null, null, null]);
    expect(await photo('u-1/p-1.jpg')).toBe('https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg?token=t1');
    expect(signs).toHaveLength(1);
  });

  it('keeps a link until five minutes before it expires, then signs it again', async () => {
    const { supabase, signs } = fakeStorage();
    let clock = 0;
    const photo = receiptPhotos(supabase, () => clock);

    const first = await photo('u-1/p-1.jpg');
    clock = 54 * 60 * 1000;
    const sameLink = await photo('https://dev.supabase.co/storage/v1/object/public/receipts/u-1/p-1.jpg');
    clock = 55 * 60 * 1000;
    const renewed = await photo('u-1/p-1.jpg');

    expect([first, sameLink, renewed]).toEqual([
      'https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg?token=t1',
      'https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg?token=t1',
      'https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg?token=t2',
    ]);
    expect(signs).toHaveLength(2);
  });

  it('shares one request between screens asking at once', async () => {
    const { supabase, signs } = fakeStorage();
    const photo = receiptPhotos(supabase, () => 0);

    expect(await Promise.all([photo('u-1/p-1.jpg'), photo('u-1/p-1.jpg')])).toEqual([
      'https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg?token=t1',
      'https://dev.supabase.co/storage/v1/object/sign/receipts/u-1/p-1.jpg?token=t1',
    ]);
    expect(signs).toHaveLength(1);
  });

  it('has no link for a photo storage refuses, and asks again next time', async () => {
    const { supabase, signs } = fakeStorage(['u-2/p-9.jpg']);
    const photo = receiptPhotos(supabase, () => 0);

    expect(await photo('u-2/p-9.jpg')).toBeNull();
    expect(await photo('u-2/p-9.jpg')).toBeNull();
    expect(signs).toEqual([
      'POST https://dev.supabase.co/storage/v1/object/sign/receipts/u-2/p-9.jpg {"expiresIn":3600}',
      'POST https://dev.supabase.co/storage/v1/object/sign/receipts/u-2/p-9.jpg {"expiresIn":3600}',
    ]);
  });
});
