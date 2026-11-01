import 'react-native-gesture-handler/jestSetup';
import type { Observable } from '@legendapp/state';
import type { CurrencyCode, MinorAmount } from '@repo/types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Text } from 'react-native';

import ReviewScreen from '@/app/review';
import { toFinanceTransaction } from '@/lib/finance/adapters';
import { buildBudgetMonth, monthKey } from '@/lib/finance/budget-month';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION } from '@/lib/finance/types';
import { dismissSheet, getOpenSheet } from '@/lib/sheet/sheet-store';
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
    isMigrated: jest.fn(() => true),
  };
});

type Rows = Observable<Record<string, Record<string, unknown>>>;
const store = jest.requireMock('@/lib/store') as Record<
  'wallets$' | 'transactions$' | 'proposedTransactions$' | 'categories$',
  Rows
>;

const MAYBANK = '00000000-0000-4000-8000-00000000000a';
const FOOD = '00000000-0000-4000-8000-0000000000f0';
const SALARY = '00000000-0000-4000-8000-0000000000f1';

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
  async function pickType(type: 'expense' | 'income' | 'transfer') {
    fireEvent.press(screen.getByTestId('review.type'));
    const sheet = getOpenSheet();
    if (sheet?.kind !== 'transactionType') throw new Error('the type chip opens the Type sheet');
    await act(async () => sheet.settle(type));
  }

  it('corrects a capture to income: the sign, the category and the rule checkbox follow', async () => {
    seed('p1');
    store.categories$[SALARY].set({
      id: SALARY,
      user_id: 'user-1',
      name: 'Salary',
      type: 'income',
      icon: 'cash',
      color: '#A9DDB5',
      is_active: true,
      display_order: 1,
      deleted: false,
    });
    await show(<ReviewScreen />);
    expect(screen.getByText('Expense')).toBeTruthy();
    expect(screen.getByText('−RM12.00')).toBeTruthy();
    expect(screen.getByText('Food & Dining')).toBeTruthy();

    await pickType('income');

    expect(screen.getByText('Income')).toBeTruthy();
    expect(screen.getByText('+RM12.00')).toBeTruthy();
    expect(screen.getByText('Pick a category')).toBeTruthy();
    expect(screen.queryByTestId('review.similar')).toBeNull();

    fireEvent.press(screen.getByTestId('review.category'));
    const sheet = getOpenSheet();
    if (sheet?.kind !== 'category') throw new Error('the category chip opens the category sheet');
    expect(sheet.request.categories.map((c) => c.name)).toEqual(['Salary']);
    await act(async () => sheet.settle(SALARY));

    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));

    expect(ledger()).toEqual([
      expect.objectContaining({ type: 'income', category_id: SALARY, merchant: 'GRAB' }),
    ]);
  });

  it('corrects a capture to a transfer: destination replaces merchant and category', async () => {
    seed('p1');
    await show(<ReviewScreen />);

    await pickType('transfer');

    expect(screen.getByText('Transfer')).toBeTruthy();
    expect(screen.getByText('RM12.00')).toBeTruthy();
    expect(screen.queryByTestId('review.merchant.edit')).toBeNull();
    expect(screen.queryByTestId('review.category')).toBeNull();
    expect(screen.getByTestId('review.destination')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('review.approve')));

    const sheet = getOpenSheet();
    expect(sheet?.kind === 'wallet' && sheet.request.title).toBe('Moves to');
    expect(ledger()).toEqual([]);
    await act(async () => dismissSheet());
  });

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

  describe('a likely duplicate', () => {
    const TNG = '00000000-0000-4000-8000-00000000000b';
    const THEN = new Date(Date.now() - 60_000).toISOString();

    function ledgerRow(over: Record<string, unknown> = {}) {
      store.transactions$.t1.set({
        id: 't1',
        user_id: 'user-1',
        wallet_id: MAYBANK,
        amount: '12.00',
        currency: 'MYR',
        type: 'expense',
        merchant: 'GRAB',
        category_id: FOOD,
        transaction_date: THEN,
        created_at: THEN,
        metadata: { source: 'notification' },
        deleted: false,
        ...over,
      });
    }

    /** What Home and Budget count this month, from the real ledger rows. */
    const spent = () => {
      const now = new Date();
      return buildBudgetMonth({
        month: monthKey(now),
        now,
        currency: 'MYR' as CurrencyCode,
        transactions: ledger().flatMap((row) => toFinanceTransaction(row) ?? []),
        categories: [],
        budgets: [],
        monthlyTotalMinor: null,
        bills: [],
        debts: [],
      }).spentMinor;
    };

    it('Same payment leaves one ledger row, counted once, and Undo brings the card back', async () => {
      ledgerRow();
      seed('p1', { transaction_date: new Date().toISOString() });
      await show(<ReviewScreen />);

      expect(await screen.findByText('Maybe a duplicate')).toBeTruthy();
      expect(screen.getByText('Approve keeps both.')).toBeTruthy();
      expect(screen.queryByTestId('review.similar')).toBeNull();

      await act(async () => fireEvent.press(screen.getByTestId('review.same-payment')));

      expect(ledger()).toHaveLength(1);
      expect(spent()).toBe(1200);
      expect(screen.getByText('All caught up')).toBeTruthy();
      expect(screen.getByText(/^0 approved, 0 not mine, 1 counted once\./)).toBeTruthy();
      expect(store.proposedTransactions$.peek().p1?.deleted).not.toBe(false);
      expect(store.transactions$.peek().t1?.metadata).toMatchObject({
        pairing: { kind: 'same_purchase', absorbed: { id: 'p1' } },
      });

      await act(async () => undoToast());

      expect(screen.getByText('GRAB')).toBeTruthy();
      expect(store.proposedTransactions$.peek().p1).toMatchObject({
        status: 'pending',
        deleted: false,
      });
      expect((store.transactions$.peek().t1?.metadata as { pairing?: unknown }).pairing).toBeUndefined();
    });

    it('Approve keeps both, as the card says', async () => {
      ledgerRow();
      seed('p1', { transaction_date: new Date().toISOString() });
      await show(<ReviewScreen />);
      await screen.findByText('Maybe a duplicate');

      await act(async () => fireEvent.press(screen.getByTestId('review.approve')));

      expect(ledger()).toHaveLength(2);
      expect(spent()).toBe(2400);
    });

    it("It's a transfer rewrites both sides as one transfer, spending nothing", async () => {
      store.wallets$[TNG].set({ id: TNG, currency: 'MYR', type: 'ewallet', name: 'TNG', deleted: false });
      financeProjection$.walletsById[TNG].set(
        financeWallet({ id: TNG, userId: 'user-1', name: 'TNG', type: 'ewallet' }),
      );
      ledgerRow({ merchant: 'TNG DIGITAL' });
      seed('p1', {
        source_app: 'my.com.tngdigital.ewallet',
        type: 'income',
        wallet_id: TNG,
        merchant: null,
        category_id: null,
        transaction_date: new Date().toISOString(),
      });
      await show(<ReviewScreen />);

      await act(async () => {
        await screen.findByTestId('review.its-a-transfer');
        fireEvent.press(screen.getByTestId('review.its-a-transfer'));
      });

      expect(ledger()).toEqual([
        expect.objectContaining({
          type: 'transfer',
          wallet_id: MAYBANK,
          transfer_to_wallet_id: TNG,
          category_id: null,
          merchant: null,
        }),
      ]);
      expect(spent()).toBe(0);
    });

    it('a card that already counts another alert quotes it and can separate them', async () => {
      seed('p1', {
        pairing: {
          kind: 'same_purchase',
          before: { merchant: 'TNG DIGITAL' },
          absorbed: {
            id: '00000000-0000-4000-9000-000000000001',
            sourceType: 'notification',
            sourceApp: 'com.maybank2u.life',
            sourceText: null,
            sourceImageUri: null,
            notificationTitle: 'Alert',
            notificationBody: 'Payment of RM12.00 to GRAB was successful.',
            notificationReceivedAt: THEN,
            aiReasoning: null,
            aiConfidence: null,
            walletId: MAYBANK,
            walletHint: null,
            transferToWalletId: null,
            transferToWalletHint: null,
            amountMinor: 1200,
            currency: 'MYR',
            type: 'expense',
            description: null,
            merchant: 'GRAB',
            categoryId: null,
            categoryHint: null,
            transactionDate: THEN,
          },
        },
      });
      await show(<ReviewScreen />);

      expect(screen.getByText('Same payment')).toBeTruthy();
      expect(
        screen.getByText(
          'Counted once with the Maybank alert: “Payment of RM12.00 to GRAB was successful.”',
        ),
      ).toBeTruthy();

      await act(async () => fireEvent.press(screen.getByTestId('review.not-same-payment')));

      expect(store.proposedTransactions$.peek().p1).toMatchObject({
        merchant: 'TNG DIGITAL',
        pairing: null,
      });
      expect(
        store.proposedTransactions$.peek()['00000000-0000-4000-9000-000000000001'],
      ).toMatchObject({ status: 'pending', merchant: 'GRAB', deleted: false });
    });

    it("It's spending turns a misread transfer back into an expense in Review", async () => {
      store.wallets$[TNG].set({ id: TNG, currency: 'MYR', type: 'ewallet', name: 'TNG', deleted: false });
      seed('p1', {
        type: 'transfer',
        wallet_id: MAYBANK,
        transfer_to_wallet_id: TNG,
        merchant: 'ALI BIN ABU',
        category_id: null,
        description: "Touch 'n Go reload",
      });
      await show(<ReviewScreen />);

      expect(screen.getByText('Approve keeps it a transfer.')).toBeTruthy();
      await act(async () => fireEvent.press(screen.getByTestId('review.not-a-transfer')));

      expect(store.proposedTransactions$.peek().p1).toMatchObject({
        type: 'expense',
        wallet_id: MAYBANK,
        transfer_to_wallet_id: null,
        merchant: 'ALI BIN ABU',
        status: 'pending',
      });
      expect(screen.getByText('ALI BIN ABU')).toBeTruthy();
      expect(ledger()).toEqual([]);
    });

    it('hides the control until the column is there for a capture waiting in Review', async () => {
      const { isMigrated } = jest.requireMock('@/lib/store') as { isMigrated: jest.Mock };
      isMigrated.mockImplementation((migration: string) => migration !== 'capture_pairing');
      seed('p1', { transaction_date: THEN });
      seed('p2', { transaction_date: new Date().toISOString() });
      await show(<ReviewScreen />);

      expect(await screen.findByText('Maybe a duplicate')).toBeTruthy();
      expect(screen.queryByTestId('review.same-payment')).toBeNull();
      isMigrated.mockImplementation(() => true);
    });
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

  it.each([
    ['Approve', 'review.approve', 'approved'],
    ['Not mine', 'review.not-mine', 'rejected'],
    ['Later', 'review.later', 'later'],
  ])('Undo after %s puts the card back on top of the next one', async (_name, button, status) => {
    seed('p1');
    seed('p2', { merchant: 'JAYA GROCER', created_at: '2020-01-01T00:00:00.000Z' });
    await show(<ReviewScreen />);

    await act(async () => fireEvent.press(screen.getByTestId(button)));
    expect(store.proposedTransactions$.p1.status.peek()).toBe(status);
    expect(screen.getByText('JAYA GROCER')).toBeTruthy();
    expect(screen.queryByText('GRAB')).toBeNull();

    await act(async () => undoToast());

    expect(store.proposedTransactions$.p1.status.peek()).toBe('pending');
    expect(screen.getByText('GRAB')).toBeTruthy();
    expect(screen.queryByText('JAYA GROCER')).toBeNull();
    expect(screen.getByText('1 of 2')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('review.not-mine')));
    expect(screen.getByText('JAYA GROCER')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
  });

  describe('the source row pill', () => {
    const filed = (count: number, merchant = 'GRAB') =>
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [
          `t${index}`,
          {
            id: `t${index}`,
            userId: 'user-1',
            walletId: MAYBANK,
            amountMinor: 1200 as MinorAmount,
            currency: 'MYR' as CurrencyCode,
            type: 'expense' as const,
            analysisExcluded: false,
            debtActivityId: null,
            categoryId: FOOD,
            transferToWalletId: null,
            linkedTransactionId: null,
            description: null,
            merchant,
            notes: null,
            transactionDate: '2026-10-01T04:00:00.000Z',
            locationLatitude: null,
            locationLongitude: null,
            locationName: null,
            autoAdded: false,
            balanceCorrection: false,
            createdAt: '2026-10-01T04:00:00.000Z',
          },
        ]),
      );

    it.each([
      [14, 'Usual for you'],
      [3, 'Usual for you'],
      [2, 'Seen before'],
      [1, 'Seen before'],
    ])('a merchant filed %i times reads %s', async (count, label) => {
      seed('p1');
      financeProjection$.transactionsById.set(filed(count));
      await show(<ReviewScreen />);
      expect(screen.getByText(label)).toBeTruthy();
    });

    it('shows no pill for a merchant never filed', async () => {
      seed('p1');
      financeProjection$.transactionsById.set(filed(14, 'Jaya Grocer'));
      await show(<ReviewScreen />);
      expect(screen.queryByText('Usual for you')).toBeNull();
      expect(screen.queryByText('Seen before')).toBeNull();
    });

    it('lets Needs a wallet outrank a merchant filed 14 times', async () => {
      seed('p1', { wallet_id: null });
      store.wallets$.set({});
      financeProjection$.walletsById.set({});
      financeProjection$.transactionsById.set(filed(14));
      await show(<ReviewScreen />);
      expect(screen.getByText('Needs a wallet')).toBeTruthy();
      expect(screen.queryByText('Usual for you')).toBeNull();
    });
  });

  it('shows the compact wallet name on the chip and speaks the full one', async () => {
    seed('p1');
    financeProjection$.walletsById[MAYBANK].name.set('Maybank Savings');
    await show(<ReviewScreen />);
    expect(screen.getByText('Maybank')).toBeTruthy();
    expect(screen.queryByText('Maybank Savings')).toBeNull();
    expect(screen.getByLabelText('Wallet Maybank Savings. Change wallet')).toBeTruthy();
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
