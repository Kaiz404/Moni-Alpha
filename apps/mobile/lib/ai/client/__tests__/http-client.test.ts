import type { AiClient } from '@/lib/ai/client/types';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } },
}));

const request = { text: 'lunch 12', wallets: [] };

/** Loading Expo installs its own global fetch, so the stand-in goes on after the client loads. */
function clientWith(fetchStandIn: (url: string, init?: RequestInit) => Promise<unknown>): AiClient {
  process.env.EXPO_PUBLIC_AI_API_URL = 'https://backend.test';
  let client!: AiClient;
  jest.isolateModules(() => {
    client = require('@/lib/ai/client/http-client').httpAiClient;
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: jest.fn(fetchStandIn),
    configurable: true,
    writable: true,
  });
  return client;
}

function clientAnswering(status: number, body: string): AiClient {
  return clientWith(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body),
  }));
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_AI_API_URL;
  jest.useRealTimers();
});

describe('what the backend being down looks like to the queue', () => {
  it("reads the backend's 503 until keys load as unavailable", async () => {
    const client = clientAnswering(
      503,
      '{"details":{"retryAfterSeconds":30},"error":"Auth keys are not loaded yet"}',
    );
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'Auth keys are not loaded yet',
    });
  });

  it("reads Cloud Run's own 503, which is not JSON, as unavailable", async () => {
    const client = clientAnswering(503, '<html>Service Unavailable</html>');
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'AI backend error (503)',
    });
  });

  it('reads a network failure as unavailable', async () => {
    const client = clientWith(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'unavailable',
      reason: 'Network request failed',
    });
  });

  it('gives up on a host that never answers, so the queue can move on', async () => {
    jest.useFakeTimers();
    const client = clientWith(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );
    const pending = client.extractFromText(request);
    await jest.advanceTimersByTimeAsync(100_000);
    await expect(pending).resolves.toEqual({
      status: 'unavailable',
      reason: 'AI backend timed out',
    });
  });

  it('passes a real skip through untouched', async () => {
    const client = clientAnswering(200, '{"status":"skipped","reason":"Not a transaction"}');
    await expect(client.extractFromText(request)).resolves.toEqual({
      status: 'skipped',
      reason: 'Not a transaction',
    });
  });
});
