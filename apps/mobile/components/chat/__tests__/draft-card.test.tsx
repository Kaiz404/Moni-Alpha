import type { ProposedTransaction } from '@repo/types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DraftCard } from '@/components/chat/draft-card';
import { Text } from '@/components/ui/text';
import { appendMessage, readThread, type ChatMessage } from '@/lib/ai/chat/messages';
import { threadDay } from '@/lib/ai/chat/sessions';
import { financeProjection$ } from '@/lib/finance/projection';
import { proposedTransactions$ } from '@/lib/store';
import {
  approveProposedTransaction,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { deleteTransaction } from '@/lib/supabase/transactions';
import { dismissToast, useToast } from '@/lib/toast/toast-store';
import { USER, financeWallet, projection } from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('@/lib/haptics', () => ({ approve: jest.fn(), notMine: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/supabase/proposed-transactions', () => ({
  ...jest.requireActual('@/lib/supabase/proposed-transactions'),
  approveProposedTransaction: jest.fn(async () => 't1'),
  rejectProposedTransaction: jest.fn(async () => {}),
  laterProposedTransaction: jest.fn(),
  findProposalDuplicate: jest.fn(async () => null),
}));
jest.mock('@/lib/supabase/transactions', () => ({ deleteTransaction: jest.fn(async () => {}) }));

const createdAt = new Date(2026, 9, 14, 13, 30).toISOString();

const parking: ProposedTransaction = {
  id: 'p1',
  userId: USER,
  sourceType: 'text',
  sourceApp: null,
  sourceText: 'paid 6 ringgit parking at KLCC',
  sourceImageUri: null,
  notificationTitle: null,
  notificationBody: null,
  notificationReceivedAt: null,
  aiReasoning: null,
  aiConfidence: null,
  walletId: 'maybank',
  walletHint: null,
  transferToWalletId: null,
  transferToWalletHint: null,
  amountMinor: 600 as ProposedTransaction['amountMinor'],
  currency: 'MYR' as ProposedTransaction['currency'],
  type: 'expense',
  description: null,
  merchant: 'KLCC Parking',
  categoryId: null,
  categoryHint: null,
  transactionDate: createdAt,
  status: 'pending',
  createdAt,
  updatedAt: createdAt,
};

const draft: ChatMessage = {
  id: 'm1',
  role: 'assistant',
  kind: 'assistant_draft',
  proposalId: 'p1',
  createdAt,
};

function ToastText() {
  const toast = useToast();
  return toast ? <Text>{toast.text}</Text> : null;
}

describe('DraftCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    financeProjection$.set({
      ...projection([financeWallet()]),
      proposalsById: { p1: parking },
    });
    proposedTransactions$.p1.set({ id: 'p1', status: 'pending', deleted: false });
    appendMessage(draft);
  });
  afterEach(() => act(() => dismissToast()));

  it('approves the edited amount through the Review actions and Undo takes it back', async () => {
    render(
      <>
        <DraftCard message={draft} />
        <ToastText />
      </>,
    );
    expect(screen.getByText('KLCC Parking')).toBeTruthy();
    expect(screen.getByTestId('chat.draft.amount-text')).toHaveTextContent('−RM6.00');

    fireEvent.press(screen.getByTestId('chat.draft.amount.edit'));
    fireEvent.changeText(screen.getByTestId('chat.draft.amount.input'), '7');
    fireEvent.press(screen.getByTestId('chat.draft.amount.save'));
    expect(screen.getByTestId('chat.draft.amount-text')).toHaveTextContent('−RM7.00');

    await act(async () => fireEvent.press(screen.getByTestId('chat.draft.approve')));
    expect(jest.mocked(approveProposedTransaction).mock.calls[0]?.[0]).toMatchObject({
      id: 'p1',
      amountMinor: 700,
      walletId: 'maybank',
    });
    expect(screen.getByText('Added −RM7.00')).toBeTruthy();
    const stored = readThread(threadDay(createdAt)).messages.find((m) => m.id === 'm1');
    expect(stored).toMatchObject({
      outcome: { kind: 'approved', title: 'Approved KLCC Parking −RM7.00' },
    });

    await act(async () => fireEvent.press(screen.getByText('Undo')));
    expect(deleteTransaction).toHaveBeenCalledWith('t1');
    const undone = readThread(threadDay(createdAt)).messages.find((m) => m.id === 'm1');
    expect(undone).not.toHaveProperty('outcome');
  });

  it('marks the capture not mine through the Review actions', async () => {
    render(
      <>
        <DraftCard message={draft} />
        <ToastText />
      </>,
    );
    await act(async () => fireEvent.press(screen.getByTestId('chat.draft.not-mine')));
    expect(rejectProposedTransaction).toHaveBeenCalledWith('p1');
    expect(screen.getAllByText('1 not mine')).toHaveLength(2);
    const stored = readThread(threadDay(createdAt)).messages.find((m) => m.id === 'm1');
    expect(stored).toMatchObject({ outcome: { kind: 'not_mine' } });
  });
});
