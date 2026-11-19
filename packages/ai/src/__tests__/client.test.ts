import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiClient, type AiClientOptions } from '../index';

type FetchStandIn = (url: string, init: { headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<unknown>;

const request = { text: 'lunch 12', wallets: [] };

function clientWith(fetchStandIn: FetchStandIn, options: Partial<AiClientOptions> = {}) {
  const fetch = vi.fn(fetchStandIn);
  vi.stubGlobal('fetch', fetch);
  const client = createAiClient({
    baseUrl: 'https://backend.test',
    getAccessToken: async () => 'jwt',
    encodeImage: async () => ({ imageBase64: 'AAAA' }),
    consent: async () => true,
    ...options,
  });
  return { client, fetch };
}

function clientAnswering(status: number, body: string, options?: Partial<AiClientOptions>) {
  return clientWith(
    async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(body),
    }),
    options,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('what the client sends', () => {
  it('posts the request as JSON with the bearer token', async () => {
    const { client, fetch } = clientAnswering(200, '{"status":"skipped","reason":"Not a transaction"}');
    await client.extractFromText(request);
    const [url, init] = fetch.mock.calls[0]!;
    expect([url, init.headers, JSON.parse(init.body)]).toEqual([
      'https://backend.test/v1/extract/text',
      { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' },
      request,
    ]);
  });

  it('sends no Authorization header when signed out', async () => {
    const { client, fetch } = clientAnswering(200, '{"status":"skipped","reason":"x"}', {
      getAccessToken: async () => null,
    });
    await client.extractFromText(request);
    expect(fetch.mock.calls[0]![1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('sends a receipt with the encoded image beside the request', async () => {
    const { client, fetch } = clientAnswering(200, '{"status":"skipped","reason":"x"}', {
      encodeImage: async (uri) => ({ imageUrl: `${uri}?signed` }),
    });
    await client.extractFromImage({ imageUri: 'https://storage.test/r.jpg', wallets: [] });
    const [url, init] = fetch.mock.calls[0]!;
    expect([url, JSON.parse(init.body)]).toEqual([
      'https://backend.test/v1/extract/image',
      { imageUri: 'https://storage.test/r.jpg', wallets: [], imageUrl: 'https://storage.test/r.jpg?signed' },
    ]);
  });

  it('skips a receipt the encoder cannot read, without the network', async () => {
    const { client, fetch } = clientAnswering(200, '{}', { encodeImage: async () => null });
    await expect(client.extractFromImage({ imageUri: 'file:///gone.jpg', wallets: [] })).resolves.toEqual({
      status: 'skipped',
      reason: 'Could not read the receipt image',
    });
    expect(fetch.mock.calls.length).toBe(0);
  });
});

describe('what the backend being down looks like to the queue', () => {
  it("reads the backend's 503 until keys load as unavailable", async () => {
    const { client } = clientAnswering(
      503,
      '{"details":{"retryAfterSeconds":30},"error":"Auth keys are not loaded yet"}',
    );
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'Auth keys are not loaded yet',
    });
  });

  it("reads Cloud Run's own 503, which is not JSON, as unavailable", async () => {
    const { client } = clientAnswering(503, '<html>Service Unavailable</html>');
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'AI backend error (503)',
    });
  });

  it('reads a network failure as unavailable', async () => {
    const { client } = clientWith(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'Network request failed',
    });
  });

  it('gives up on a host that never answers, so the queue can move on', async () => {
    vi.useFakeTimers();
    const { client } = clientWith(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );
    const pending = client.extractFromText(request);
    await vi.advanceTimersByTimeAsync(100_000);
    await expect(pending).resolves.toEqual({ status: 'unavailable', reason: 'AI backend timed out' });
  });

  it('reads a token that says AI is off as the consent reason, which the queue waits on', async () => {
    const { client } = clientAnswering(
      403,
      '{"details":{"reason":"consent"},"error":"Moni\'s AI is turned off for this account"}',
    );
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'consent',
    });
  });
});

describe('what the client accepts back', () => {
  it('passes a real skip through untouched', async () => {
    const { client } = clientAnswering(200, '{"status":"skipped","reason":"Not a transaction"}');
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'skipped',
      reason: 'Not a transaction',
    });
  });

  it('reads an extraction missing a field as unavailable, so the queue retries', async () => {
    const { client } = clientAnswering(200, '{"status":"ok","extraction":{"amount":12}}');
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'Unexpected AI backend response',
    });
  });

  it('drops keys a newer backend adds, so an old build keeps working', async () => {
    const { client } = clientAnswering(
      200,
      '{"status":"ok","reply":"RM42 on food","modelId":"m","usage":{"tokens":9}}',
    );
    await expect(
      client.analyzeFinances({
        message: 'food?',
        snapshot: { schema: 'finance_assistant_tool_v4', generatedAt: '2026-10-14T00:00:00Z', currencies: {} },
      }),
    ).resolves.toEqual({ status: 'ok', reply: 'RM42 on food', modelId: 'm' });
  });
});

describe("a call while that use of Moni's AI is off", () => {
  it('answers unavailable for consent and never reaches the backend', async () => {
    const { client, fetch } = clientAnswering(200, '{"status":"skipped","reason":"x"}', {
      consent: async () => false,
    });
    const off = { status: 'unavailable', reason: 'consent' };
    const calls: Promise<unknown>[] = [
      client.extractFromText(request),
      client.extractFromImage({ imageUri: 'file:///r.jpg', wallets: [] }),
      client.extractFromNotification({
        notification: { id: 'n', app: 'p', packageName: 'p', title: 't', text: 'x', time: '1', receivedAt: 'r' },
        wallets: [],
      }),
      client.analyzeFinances({
        message: 'hi',
        snapshot: { schema: 'finance_assistant_tool_v4', generatedAt: 'g', currencies: {} },
      }),
    ];
    await expect(Promise.all(calls)).resolves.toEqual([off, off, off, off]);
    expect(fetch.mock.calls.length).toBe(0);
  });

  it('reaches the backend once it is on', async () => {
    let on = false;
    const { client, fetch } = clientAnswering(200, '{"status":"skipped","reason":"Not a transaction"}', {
      consent: async () => on,
    });
    const send = (): Promise<unknown> => client.extractFromText(request);
    await send();
    on = true;
    await expect(send()).resolves.toEqual({ status: 'skipped', reason: 'Not a transaction' });
    expect(fetch.mock.calls.length).toBe(1);
  });
});
