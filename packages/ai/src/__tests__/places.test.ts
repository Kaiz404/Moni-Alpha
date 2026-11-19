import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlacesClient } from '../index';

const backend = { baseUrl: 'https://backend.test', getAccessToken: async () => 'jwt' };
const search = { input: 'village', sessionToken: 's1', bias: null };

function answering(status: number, body: string) {
  const reply = { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body) };
  const fetch = vi.fn<(url: string, init: { body: string }) => Promise<typeof reply>>(async () => reply);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('place search through the gateway', () => {
  it('posts the search and returns the predictions', async () => {
    const fetch = answering(
      200,
      '{"status":"ok","predictions":[{"placeId":"p1","primaryText":"Village Park","secondaryText":null,"distanceMeters":120}]}',
    );
    await expect(createPlacesClient(backend).autocomplete(search)).resolves.toEqual({
      status: 'ok',
      predictions: [{ placeId: 'p1', primaryText: 'Village Park', secondaryText: null, distanceMeters: 120 }],
    });
    expect([fetch.mock.calls[0]![0], JSON.parse(fetch.mock.calls[0]![1].body)]).toEqual([
      'https://backend.test/v1/places/autocomplete',
      search,
    ]);
  });

  it('reads a place outside the map as unavailable', async () => {
    answering(200, '{"status":"ok","place":{"placeId":"p1","latitude":91,"longitude":0,"address":null}}');
    await expect(
      createPlacesClient(backend).details({ placeId: 'p1', sessionToken: null }),
    ).resolves.toEqual({ status: 'unavailable' });
  });

  it('reads a refused call as unavailable', async () => {
    answering(429, '{"error":"Too many requests"}');
    await expect(createPlacesClient(backend).autocomplete(search)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('passes not found through', async () => {
    answering(200, '{"status":"not_found"}');
    await expect(
      createPlacesClient(backend).details({ placeId: 'gone', sessionToken: 's1' }),
    ).resolves.toEqual({ status: 'not_found' });
  });
});
