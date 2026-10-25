import type { ProposedTransaction } from '@repo/types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CapturesCard } from '@/components/chat/captures-card';
import { financeProjection$ } from '@/lib/finance/projection';
import { proposedTransactions$ } from '@/lib/store';
import { rejectProposedTransaction } from '@/lib/supabase/proposed-transactions';
import { USER, financeWallet, projection } from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/haptics', () => ({ approve: jest.fn(), notMine: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/supabase/proposed-transactions', () => ({
  ...jest.requireActual('@/lib/supabase/proposed-transactions'),
  rejectProposedTransaction: jest.fn(async () => {}),
  restoreRejectedProposal: jest.fn(async () => {}),
}));

const createdAt = new Date(2026, 9, 14, 13, 30).toISOString();

function capture(id: string, merchant: string, amountMinor: number): ProposedTransaction {
  return {
    id,
    userId: USER,
    sourceType: 'notification',
    sourceApp: null,
    sourceText: null,
    sourceImageUri: null,
    notificationTitle: 'Maybank',
    notificationBody: null,
    notificationReceivedAt: null,
    aiReasoning: null,
    aiConfidence: null,
    walletId: 'maybank',
    walletHint: null,
    transferToWalletId: null,
    transferToWalletHint: null,
    amountMinor: amountMinor as ProposedTransaction['amountMinor'],
    currency: 'MYR' as ProposedTransaction['currency'],
    type: 'expense',
    description: null,
    merchant,
    categoryId: null,
    categoryHint: null,
    transactionDate: createdAt,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
  };
}

describe('CapturesCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    financeProjection$.set({
      ...projection([financeWallet()]),
      proposalsById: { p1: capture('p1', 'GRAB*FOOD', 2340), p2: capture('p2', 'Jaya Grocer', 8640) },
    });
    proposedTransactions$.p1.set({ id: 'p1', status: 'pending', deleted: false });
    proposedTransactions$.p2.set({ id: 'p2', status: 'pending', deleted: false });
  });

  it('lists the waiting captures and settles one in place', async () => {
    render(<CapturesCard proposalIds={['p1', 'p2']} />);
    expect(screen.getByTestId('chat.answer.title')).toHaveTextContent('2 captures, RM109.80');
    expect(screen.getByText('−RM23.40 · Maybank alert')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('chat.captures.not-mine.p1')));
    expect(rejectProposedTransaction).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Not mine')).toBeTruthy();
    expect(screen.getByTestId('chat.answer.title')).toHaveTextContent('1 capture, RM86.40');
  });
});
