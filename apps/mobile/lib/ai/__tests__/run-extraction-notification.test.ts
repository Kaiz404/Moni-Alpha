import { runExtraction } from '../run-extraction';
import type { NotificationQueueItem } from '../processing-queue';

const mockExtract = jest.fn(async () => ({ status: 'skipped', reason: 'stub' }));

jest.mock('@/lib/ai/client', () => ({
  getAiClient: () => ({ extractFromNotification: mockExtract }),
}));
jest.mock('@/lib/supabase/wallets', () => ({
  getWallets: async () => [
    { id: 'w1', name: 'Maybank', notificationPackage: 'com.maybank2u.life', isActive: true },
    {
      id: 'w2',
      name: 'Rainy day',
      type: 'cash',
      currency: 'MYR',
      notificationPackage: 'com.example.anybank',
      notificationAccountHint: null,
      isActive: true,
      recordLocation: true,
    },
    {
      id: 'w3',
      name: 'Private',
      type: 'bank',
      currency: 'MYR',
      notificationPackage: 'com.example.private',
      isActive: true,
      recordLocation: false,
    },
  ],
}));
jest.mock('@/lib/supabase/categories', () => ({ getCategories: async () => [] }));
jest.mock('@/lib/supabase/transactions', () => ({
  createTransaction: jest.fn(),
  getTransactions: async () => [],
  transactionExists: () => false,
}));
jest.mock('@/lib/supabase/proposed-transactions', () => ({
  createProposedTransaction: jest.fn(),
  findProposalDuplicate: jest.fn(),
  proposalExists: () => false,
}));
jest.mock('@/lib/supabase/auto-add-rules', () => ({ listAutoAddRules: () => [] }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/wallets/default-wallet', () => ({ getDefaultWalletId: () => null }));
jest.mock('@/lib/ai/proposal-location-cache', () => ({ saveProposalLocationSnapshot: jest.fn() }));

function queued(notification: Record<string, unknown>): NotificationQueueItem {
  return {
    id: 'n1',
    type: 'notification',
    status: 'pending',
    createdAt: '2026-11-01T01:00:00.000Z',
    notification: {
      id: 'n1',
      app: 'com.maybank2u.life',
      packageName: 'com.maybank2u.life',
      title: 'Maybank',
      text: '',
      time: '1',
      receivedAt: '2026-11-01T01:00:00.000Z',
      ...notification,
    } as NotificationQueueItem['notification'],
  };
}

beforeEach(() => mockExtract.mockClear());

describe('an alert from an app Moni has never heard of', () => {
  const alert = (packageName: string) =>
    queued({
      app: packageName,
      packageName,
      title: 'Any Bank',
      text: 'You paid RM20.00 to Ali',
    });
  const extraction = (walletId: string) => ({
    status: 'ok',
    extraction: {
      amount: '20.00',
      currency: 'MYR',
      type: 'expense',
      merchant: 'Ali',
      description: 'Ali',
      walletId,
      walletHint: null,
      transferToWalletId: null,
      transferToWalletHint: null,
      categoryHint: null,
      occurredAt: null,
      confidence: 0.9,
      reasoning: 'paid',
    },
  });
  const proposal = () => {
    const { createProposedTransaction } = jest.requireMock('@/lib/supabase/proposed-transactions');
    return jest.mocked(createProposedTransaction);
  };
  const saved = () => {
    const { saveProposalLocationSnapshot } = jest.requireMock('@/lib/ai/proposal-location-cache');
    return jest.mocked(saveProposalLocationSnapshot);
  };
  const place = { latitude: 3.1, longitude: 101.6, name: 'Bangsar', capturedAt: 'now' };

  beforeEach(() => {
    proposal().mockReset().mockImplementation(async () => ({ id: 'n1' }));
    saved().mockClear();
  });

  it('routes to the one wallet linked to it, locked', async () => {
    await runExtraction(alert('com.example.anybank'));

    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(mockExtract.mock.calls[0]).toEqual([
      expect.objectContaining({
        wallets: [
          { id: 'w2', name: 'Rainy day', type: 'cash', currency: 'MYR', accountHint: null },
        ],
        lockedWalletId: 'w2',
      }),
    ]);
  });

  it('becomes a proposal on that wallet with no known bank in the table', async () => {
    mockExtract.mockResolvedValueOnce(extraction('w2') as never);

    await runExtraction({ ...alert('com.example.anybank'), locationSnapshot: place } as never);

    expect(proposal().mock.calls[0]?.[0]).toMatchObject({
      sourceApp: 'com.example.anybank',
      walletId: 'w2',
      type: 'expense',
    });
    expect(saved()).toHaveBeenCalledWith('n1', place);
  });

  it('drops the place when this wallet has location off', async () => {
    mockExtract.mockResolvedValueOnce(extraction('w3') as never);

    await runExtraction({ ...alert('com.example.private'), locationSnapshot: place } as never);

    expect(proposal().mock.calls[0]?.[0]).toMatchObject({ walletId: 'w3' });
    expect(saved()).not.toHaveBeenCalled();
  });

  it('stops an app no wallet links before the wire', async () => {
    const result = await runExtraction(alert('com.example.otherbank'));

    expect(mockExtract).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      created: false,
      skipped: true,
      reason: 'No wallet linked to notification app',
    });
  });
});

describe('what a notification sends to the backend', () => {
  it('sends nothing for a code queued before the on-device rule existed', async () => {
    const result = await runExtraction(queued({ text: 'TAC for a transfer of RM 300' }));
    expect(mockExtract).not.toHaveBeenCalled();
    expect(result).toMatchObject({ created: false, skipped: true });
  });

  it('sends nothing for a code hidden in grouped messages', async () => {
    await runExtraction(
      queued({
        text: 'You paid RM20.00 to Ali',
        groupedMessages: [{ title: 'Maybank', text: 'Your TAC is 482910' }],
      }),
    );
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('sends only the fields the backend reads', async () => {
    await runExtraction(
      queued({
        text: 'You paid RM20.00 to Ali',
        icon: 'data:image/png;base64,AAAA',
        image: 'data:image/png;base64,BBBB',
        groupedMessages: [{ title: 'Ali', text: 'see you later' }],
      }),
    );
    const sent = (mockExtract.mock.calls as unknown as [{ notification: object }][])[0][0]
      .notification;
    expect(sent).toEqual({
      id: 'n1',
      app: 'com.maybank2u.life',
      packageName: 'com.maybank2u.life',
      title: 'Maybank',
      text: 'You paid RM20.00 to Ali',
      time: '1',
      receivedAt: '2026-11-01T01:00:00.000Z',
    });
  });
});
