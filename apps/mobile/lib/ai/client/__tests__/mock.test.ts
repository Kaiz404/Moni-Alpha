import type { AiClient } from '@/lib/ai/client/types';
import type { FinanceAssistantToolSnapshot } from '@/lib/ai/snapshot/finance-metrics';

function loadMock(appVariant: string | undefined): AiClient {
  let client!: AiClient;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: appVariant ? { appVariant } : {} } },
    }));
    client = require('@/lib/ai/client/mock').mockAiClient;
  });
  return client;
}

const wallets = [{ id: 'w-cash', name: 'Cash', type: 'cash', currency: 'MYR' }];
const notification = {
  id: 'n1',
  app: 'com.android.shell',
  packageName: 'com.android.shell',
  title: 'Maybank',
  text: "MAYBANK: You've spent RM23.40 at GRAB*FOOD on 14/10 12:41.",
  time: '1760416860000',
  receivedAt: '2026-10-14T04:41:00.000Z',
};
const snapshot = {} as FinanceAssistantToolSnapshot;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('mock AI client in the Moni E2E build', () => {
  const client = () => loadMock('e2e');

  it('reads the parking sentence the Say it and chat flows use', async () => {
    const result = await client().extractFromText({
      text: 'Paid 6 ringgit parking at KLCC.',
      wallets,
    });
    expect(result).toEqual({
      status: 'ok',
      extraction: {
        amount: 6,
        type: 'expense',
        currency: 'MYR',
        merchant: 'Parking KLCC',
        description: null,
        walletHint: null,
        categoryHint: 'Transport',
        walletId: null,
        transferToWalletHint: null,
        transferToWalletId: null,
        confidence: 0.71,
        reasoning: 'You said parking at KLCC.',
        occurredAt: null,
      },
    });
  });

  it('reads any scanned image as the mamak receipt', async () => {
    const result = await client().extractFromImage({ imageUri: 'file:///cache/scan.jpg', wallets });
    expect(
      result.status === 'ok' && [result.extraction.merchant, result.extraction.amount],
    ).toEqual(['Restoran Nasi Kandar Ali', 15.3]);
  });

  it('parses a Maybank spend alert and keeps the locked wallet', async () => {
    const result = await client().extractFromNotification({
      notification,
      wallets,
      lockedWalletId: 'w-maybank',
    });
    expect(
      result.status === 'ok' && [
        result.extraction.merchant,
        result.extraction.amount,
        result.extraction.categoryHint,
        result.extraction.walletId,
      ],
    ).toEqual(['GRAB*FOOD', 23.4, 'Food & Dining', 'w-maybank']);
  });

  it('answers the Transport question the chat answer flow asks', async () => {
    await expect(
      client().analyzeFinances({ message: 'How much on Transport this month', snapshot }),
    ).resolves.toEqual({
      status: 'ok',
      reply: 'Most of your Transport this month went on Grab rides and petrol.',
      modelId: 'e2e-fixture',
    });
  });

  it('keeps unavailable for input it has no fixture for', async () => {
    await expect(client().extractFromText({ text: 'bought a sofa', wallets })).resolves.toEqual({
      status: 'unavailable',
      reason: 'AI backend is not available yet. Inference will run on a dedicated Go service.',
    });
    await expect(
      client().analyzeFinances({ message: 'Can I afford a sofa', snapshot }),
    ).resolves.toMatchObject({
      status: 'unavailable',
    });
  });
});

describe('mock AI client in the daily build', () => {
  const unavailable = {
    status: 'unavailable',
    reason: 'AI backend is not available yet. Inference will run on a dedicated Go service.',
  };

  it.each([undefined, 'daily'])(
    'answers every fixture input with unavailable when appVariant is %s',
    async (variant) => {
      const client = loadMock(variant);
      await expect(
        client.extractFromText({ text: 'paid 6 ringgit parking at KLCC', wallets }),
      ).resolves.toEqual(unavailable);
      await expect(
        client.extractFromImage({ imageUri: 'file:///cache/scan.jpg', wallets }),
      ).resolves.toEqual(unavailable);
      await expect(client.extractFromNotification({ notification, wallets })).resolves.toEqual(
        unavailable,
      );
      await expect(
        client.analyzeFinances({ message: 'How much on Transport this month', snapshot }),
      ).resolves.toEqual(unavailable);
    },
  );
});
