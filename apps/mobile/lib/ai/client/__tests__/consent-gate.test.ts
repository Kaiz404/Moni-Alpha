import { gateByConsent } from '@/lib/ai/client/consent-gate';
import type { AiClient } from '@/lib/ai/client/types';

const READ = { status: 'skipped', reason: 'Not a transaction' } as const;

function backend() {
  return {
    extractFromText: jest.fn(async () => READ),
    extractFromImage: jest.fn(async () => READ),
    extractFromNotification: jest.fn(async () => READ),
    analyzeFinances: jest.fn(async () => ({ status: 'ok', reply: 'RM42', modelId: 'm' }) as const),
  } satisfies AiClient;
}

const text = { text: 'lunch 12', wallets: [] };

describe("a call while that use of Moni's AI is off", () => {
  it('answers unavailable for consent and never reaches the backend', async () => {
    const inner = backend();
    const client = gateByConsent(inner, async () => false);
    const off = { status: 'unavailable', reason: 'consent' };
    await expect(client.extractFromText(text)).resolves.toEqual(off);
    await expect(client.extractFromImage({ imageUri: 'file:///r.jpg', wallets: [] })).resolves.toEqual(off);
    await expect(
      client.extractFromNotification({
        notification: { id: 'n', app: 'Maybank', packageName: 'p', title: 't', text: 'x', time: '1', receivedAt: 'r' },
        wallets: [],
      }),
    ).resolves.toEqual(off);
    await expect(
      client.analyzeFinances({ message: 'hi', snapshot: {} as Parameters<AiClient['analyzeFinances']>[0]['snapshot'] }),
    ).resolves.toEqual(off);
    expect(Object.values(inner).map((call) => call.mock.calls.length)).toEqual([0, 0, 0, 0]);
  });

  it('passes the call through once it is on', async () => {
    const inner = backend();
    const client = gateByConsent(inner, async () => true);
    await expect(client.extractFromText(text)).resolves.toEqual(READ);
    expect(inner.extractFromText).toHaveBeenCalledWith(text);
  });
});
