import type { ProposedTransaction } from '@repo/types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DraftCard } from '@/components/chat/draft-card';
import { Text } from '@/components/ui/text';
import { appendMessage, readThread, type ChatMessage } from '@/lib/ai/chat/messages';
import { threadDay } from '@/lib/ai/chat/sessions';
import { financeProjection$ } from '@/lib/finance/projection';
import {
  approveProposedTransaction,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { dismissToast, useToast } from '@/lib/toast/toast-store';
import { USER, financeWallet, projection } from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('@/lib/haptics', () => ({ approve: jest.fn(), notMine: jest.fn() }));
jest.mock('@/lib/supabase/proposed-transactions', () => ({
  approveProposedTransaction: jest.fn(async () => {}),
  rejectProposedTransaction: jest.fn(async () => {}),
  laterProposedTransaction: jest.fn(),
}));

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
    appendMessage(draft);
  });

  it('shows the capture and approves the edited amount once the toast commits', async () => {
    render(<DraftCard message={draft} />);
    expect(screen.getByText('KLCC Parking')).toBeTruthy();
    expect(screen.getByTestId('chat.draft.amount-text')).toHaveTextContent('−RM6.00');

    fireEvent.press(screen.getByTestId('chat.draft.amount'));
    fireEvent.changeText(screen.getByTestId('chat.draft.field'), '7');
    fireEvent.press(screen.getByTestId('chat.draft.save'));
    expect(screen.getByTestId('chat.draft.amount-text')).toHaveTextContent('−RM7.00');

    fireEvent.press(screen.getByTestId('chat.draft.approve'));
    expect(screen.getByTestId('chat.draft.done.p1')).toHaveTextContent(
      'Approved KLCC Parking −RM7.00',
    );
    expect(approveProposedTransaction).not.toHaveBeenCalled();

    await act(async () => dismissToast());
    expect(jest.mocked(approveProposedTransaction).mock.calls[0]?.[0]).toMatchObject({
      id: 'p1',
      amountMinor: 700,
      walletId: 'maybank',
    });
    const stored = readThread(threadDay(createdAt)).messages.find((m) => m.id === 'm1');
    expect(stored).toMatchObject({ outcome: { kind: 'approved' } });
  });

  it('says "1 not mine" and Undo brings the card back without rejecting', () => {
    render(
      <>
        <DraftCard message={draft} />
        <ToastText />
      </>,
    );
    fireEvent.press(screen.getByTestId('chat.draft.not-mine'));
    expect(screen.getAllByText('1 not mine').length).toBe(2);
    fireEvent.press(screen.getByTestId('chat.draft.undo'));
    expect(screen.getByTestId('chat.draft.approve')).toBeTruthy();
    expect(rejectProposedTransaction).not.toHaveBeenCalled();
  });
});
