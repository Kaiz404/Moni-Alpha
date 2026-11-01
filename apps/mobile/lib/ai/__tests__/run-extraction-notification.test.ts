import { runExtraction } from '../run-extraction';
import type { NotificationQueueItem } from '../processing-queue';

const mockExtract = jest.fn(async () => ({ status: 'skipped', reason: 'stub' }));

jest.mock('@/lib/ai/client', () => ({
  getAiClient: () => ({ extractFromNotification: mockExtract }),
}));
jest.mock('@/lib/supabase/wallets', () => ({
  getWallets: async () => [
    { id: 'w1', name: 'Maybank', notificationPackage: 'com.maybank2u.life', isActive: true },
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
  combineIntoTransfer: jest.fn(),
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
