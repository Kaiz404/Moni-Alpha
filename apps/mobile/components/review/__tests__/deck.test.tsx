import 'react-native-gesture-handler/jestSetup';
import type { Observable } from '@legendapp/state';
import type { CurrencyCode, MinorAmount } from '@repo/types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Text } from 'react-native';

import ReviewScreen from '@/app/review';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION } from '@/lib/finance/types';
import { getOpenSheet } from '@/lib/sheet/sheet-store';
import { dismissToast, undoToast, useToast } from '@/lib/toast/toast-store';
import { financeWallet } from '@/lib/wallets/__tests__/balance-fixture';

let mockNextId = 0;
let mockParams: { id?: string } = {};
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockNextId).padStart(12, '0')}` }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/supabase/profile', () => ({ ensureFinanceTimezone: async () => 'Asia/Kuala_Lumpur' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/notifications/installed-apps', () => ({
  getCachedInstalledAppsMap: () => new Map([['com.maybank2u.life', { label: 'Maybank' }]]),
}));
jest.mock('@/lib/haptics', () => ({
  approve: jest.fn(),
  notMine: jest.fn(),
  thresholdOn: jest.fn(),
  thresholdOff: jest.fn(),
  toggleOn: jest.fn(),
  toggleOff: jest.fn(),
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    categoryBudgets$: observable({}),
    debts$: observable({}),
    debtActivities$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    merchantAliases$: observable({}),
    profilePreferences$: observable({ currency: 'MYR' }),
    recurringOverrides$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});

type Rows = Observable<Record<string, Record<string, unknown>>>;
const store = jest.requireMock('@/lib/store') as Record<
  'wallets$' | 'transactions$' | 'proposedTransactions$' | 'categories$',
  Rows
>;

const MAYBANK = '00000000-0000-4000-8000-00000000000a';
const FOOD = '00000000-0000-4000-8000-0000000000f0';

function seed(id: string, over: Record<string, unknown> = {}) {
  store.proposedTransactions$[id].set({
    id,
    user_id: 'user-1',
    source_type: 'notification',
    source_app: 'com.maybank2u.life',
    notification_body: "MAYBANK: You've spent RM12.00 at GRAB on 14/10 12:41.",
    ai_reasoning: 'You filed GRAB under Food & Dining 14 times.',
    amount: '12.00',
    currency: 'MYR',
    type: 'expense',
    merchant: 'GRAB',
    wallet_id: MAYBANK,
    category_id: FOOD,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted: false,
    ...over,
  });
}

/** Tests have no layout pass; give the deck the 390-wide phone's card area. */
async function show(ui: React.ReactElement) {
  render(ui);
  await act(async () => {});
  const deck = screen.queryByTestId('review.deck');
  if (deck) {
    fireEvent(deck, 'layout', { nativeEvent: { layout: { width: 390, height: 640 } } });
  }
}

const ledger = () =>
  Object.values(store.transactions$.peek()).filter((row) => row.deleted === false);

beforeEach(() => {
  mockParams = {};
  store.proposedTransactions$.set({});
  store.transactions$.set({});
  store.wallets$.set({ [MAYBANK]: { id: MAYBANK, currency: 'MYR', deleted: false } });
  store.categories$.set({
    [FOOD]: {
      id: FOOD,
      user_id: 'user-1',
      name: 'Food & Dining',
      type: 'expense',
      icon: 'silverware-fork-knife',
      color: '#F1A399',
      is_active: true,
      display_order: 0,
      deleted: false,
    },
  });
  financeProjection$.set({
    ...EMPTY_FINANCE_PROJECTION,
    walletsById: { [MAYBANK]: financeWallet({ id: MAYBANK, userId: 'user-1', name: 'Maybank' }) },
  });
});

afterEach(() => {
  act(() => dismissToast());
});

describe('Review deck', () => {
  it('approves the top card from the button, then Not mine ends on All caught up', async () => {
    seed('p1');
    seed('p2', {
      merchant: 'JAYA GROCER',
      amount: '86.40',
      created_at: '2020-01-01T00:00:00.000Z',
    });
    await show(<ReviewScreen />);

    expect(screen.getByText('GRAB')).toBeTruthy();
    expect(screen.getByText('Maybank alert')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByTestId('review.next-card')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));

    expect(ledger()).toEqual([
      expect.objectContaining({ merchant: 'GRAB', amount: '12.00', wallet_id: MAYBANK }),
    ]);
    expect(screen.getByText('JAYA GROCER')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('review.not-mine')));

    expect(store.proposedTransactions$.peek().p2).toMatchObject({ status: 'rejected', deleted: false });
    expect(ledger()).toHaveLength(1);
    expect(screen.getByText('All caught up')).toBeTruthy();
    expect(screen.getByText(/^1 approved, 1 not mine\. RM12\.00 now counts in \w+\.$/)).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('Undo on the toast removes the ledger row and brings the card back', async () => {
    seed('p1');
    await show(<ReviewScreen />);

    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));
    expect(screen.getByText('All caught up')).toBeTruthy();

    await act(async () => undoToast());

    expect(ledger()).toEqual([]);
    expect(screen.getByText('GRAB')).toBeTruthy();
    expect(screen.getByText('1 of 1')).toBeTruthy();
  });

  it('asks for a wallet instead of approving a capture without one', async () => {
    seed('p1', { wallet_id: null });
    store.wallets$.set({});
    financeProjection$.walletsById.set({});
    await show(<ReviewScreen />);

    expect(screen.getByText('Needs a wallet')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));

    expect(getOpenSheet()?.kind).toBe('wallet');
    expect(ledger()).toEqual([]);
  });

  it('puts the capture named by id first', async () => {
    seed('p1');
    seed('p2', { merchant: 'JAYA GROCER', created_at: '2020-01-01T00:00:00.000Z' });
    mockParams = { id: 'p2' };
    await show(<ReviewScreen />);

    expect(screen.getByText('JAYA GROCER')).toBeTruthy();
    expect(screen.queryByText('GRAB')).toBeNull();
  });

  it('edits the amount in place, and Approve writes the edited amount', async () => {
    seed('p1');
    await show(<ReviewScreen />);

    fireEvent.press(screen.getByTestId('review.amount.edit'));
    fireEvent.changeText(screen.getByTestId('review.amount.input'), '15.50');
    fireEvent.press(screen.getByTestId('review.amount.save'));
    expect(screen.getByText('−RM15.50')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));
    expect(ledger()).toEqual([expect.objectContaining({ amount: '15.50' })]);
  });

  it("Don't ask about similar adds an auto-add rule on Approve; Later snoozes the capture", async () => {
    seed('p1');
    seed('p2', { merchant: 'JAYA GROCER', created_at: '2020-01-01T00:00:00.000Z' });
    await show(<ReviewScreen />);

    fireEvent.press(screen.getByTestId('review.similar'));
    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));
    const rules = jest.requireMock('@/lib/store').autoAddRules$ as Rows;
    expect(Object.values(rules.peek())).toEqual([
      expect.objectContaining({ merchant_key: 'grab', wallet_id: MAYBANK, category_id: FOOD }),
    ]);

    await act(async () => fireEvent.press(screen.getByTestId('review.later')));
    expect(store.proposedTransactions$.p2.status.peek()).toBe('later');
    expect(screen.getByText(/^1 approved, 0 not mine, 1 for later\./)).toBeTruthy();
  });

  it('shows Nothing to review when the queue is empty', async () => {
    await show(<ReviewScreen />);
    expect(screen.getByText('Nothing to review')).toBeTruthy();
    expect(screen.getByText('0 left')).toBeTruthy();
  });
});

describe('Recently reviewed', () => {
  const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

  function ToastText() {
    const toast = useToast();
    return toast ? <Text>{toast.text}</Text> : null;
  }

  function reviewed(id: string, over: Record<string, unknown>) {
    seed(id, { created_at: hoursAgo(30), transaction_date: hoursAgo(30), ...over });
  }

  it('lists the decisions under All caught up, and Move back to review puts a Not mine card back', async () => {
    seed('p1');
    seed('p2', { merchant: 'JAYA GROCER', amount: '86.40', created_at: '2020-01-01T00:00:00.000Z' });
    await show(
      <>
        <ReviewScreen />
        <ToastText />
      </>,
    );

    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));
    await act(async () => fireEvent.press(screen.getByTestId('review.not-mine')));

    expect(screen.getByText('Recently reviewed')).toBeTruthy();
    expect(screen.getByText(/^Today · /)).toBeTruthy();
    expect(screen.getByText('Not mine')).toBeTruthy();
    expect(screen.getByText('−RM86.40')).toBeTruthy();
    expect(screen.queryByTestId('review.history.p1.move-back')).toBeNull();

    await act(async () => fireEvent.press(screen.getByTestId('review.history.p2.move-back')));

    expect(store.proposedTransactions$.p2.peek()).toMatchObject({
      status: 'pending',
      reviewed_at: null,
    });
    expect(screen.getByText('JAYA GROCER')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(screen.getByText('Moved back to review')).toBeTruthy();
  });

  it('opens the transaction an approved row created, with its source as the meta', async () => {
    reviewed('ok', { status: 'approved', reviewed_at: hoursAgo(26), transaction_id: 't1' });
    reviewed('no', {
      status: 'rejected',
      reviewed_at: hoursAgo(25),
      merchant: 'KEDAI ABC',
      source_type: 'text',
    });
    financeProjection$.transactionsById.set({
      t1: {
        id: 't1',
        userId: 'user-1',
        walletId: MAYBANK,
        amountMinor: 1250 as MinorAmount,
        currency: 'MYR' as CurrencyCode,
        type: 'expense',
        analysisExcluded: false,
        debtActivityId: null,
        categoryId: FOOD,
        transferToWalletId: null,
        linkedTransactionId: null,
        description: null,
        merchant: 'GRAB',
        notes: null,
        transactionDate: hoursAgo(30),
        locationLatitude: null,
        locationLongitude: null,
        locationName: null,
        autoAdded: false,
        balanceCorrection: false,
        createdAt: hoursAgo(30),
      },
    });
    await show(<ReviewScreen />);

    expect(screen.getByText('Nothing to review')).toBeTruthy();
    expect(screen.getByText(/^Yesterday · /)).toBeTruthy();
    expect(screen.getByText('−RM12.50')).toBeTruthy();
    expect(screen.getByText(/^Notification · Yesterday, /)).toBeTruthy();
    expect(screen.getByText(/^Moni · Yesterday, /)).toBeTruthy();

    fireEvent.press(screen.getByTestId('review.history.ok'));

    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/transaction/[id]',
      params: { id: 't1' },
    });
  });

  it('lists what Moni added without asking this week under Added for you', async () => {
    const row = (id: string, autoAdded: boolean, hours: number) => ({
      id,
      userId: 'user-1',
      walletId: MAYBANK,
      amountMinor: 10000 as MinorAmount,
      currency: 'MYR' as CurrencyCode,
      type: 'expense' as const,
      analysisExcluded: false,
      debtActivityId: null,
      categoryId: FOOD,
      transferToWalletId: null,
      linkedTransactionId: null,
      description: null,
      merchant: `SHOP ${id}`,
      notes: null,
      transactionDate: hoursAgo(hours),
      locationLatitude: null,
      locationLongitude: null,
      locationName: null,
      autoAdded,
      balanceCorrection: false,
      createdAt: hoursAgo(hours),
    });
    financeProjection$.transactionsById.set({
      a1: row('a1', true, 20),
      a2: row('a2', true, 24 * 9),
      m1: row('m1', false, 20),
    });
    await show(<ReviewScreen />);

    expect(screen.getByText('Added for you')).toBeTruthy();
    expect(screen.getByText('SHOP a1')).toBeTruthy();
    expect(screen.queryByText('SHOP a2')).toBeNull();
    expect(screen.queryByText('SHOP m1')).toBeNull();

    fireEvent.press(screen.getByTestId('review.added.a1'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/transaction/[id]',
      params: { id: 'a1' },
    });
  });

  it('folds under the deck while captures wait, and Move back to review puts that card on top', async () => {
    seed('p1');
    reviewed('old', { status: 'rejected', reviewed_at: hoursAgo(25), merchant: 'KEDAI ABC' });
    await show(<ReviewScreen />);

    expect(screen.getByText('GRAB')).toBeTruthy();
    expect(screen.queryByText('KEDAI ABC')).toBeNull();

    await act(async () => fireEvent.press(screen.getByText('Recently reviewed · 1')));

    expect(screen.queryByTestId('review.deck')).toBeNull();
    expect(screen.getByText('KEDAI ABC')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('review.history.old.move-back')));
    fireEvent(screen.getByTestId('review.deck'), 'layout', {
      nativeEvent: { layout: { width: 390, height: 640 } },
    });

    expect(screen.getByText('KEDAI ABC')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.queryByText('Recently reviewed · 1')).toBeNull();
  });
});
