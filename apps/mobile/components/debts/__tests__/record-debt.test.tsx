import 'react-native-gesture-handler/jestSetup';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import NewDebtScreen from '@/app/debt/new';
import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION } from '@/lib/finance/types';
import {
  addDebtPrincipal,
  createDebt,
  getDebtById,
} from '@/lib/supabase/debts';
import { showToast } from '@/lib/toast/toast-store';
import { dismissSheet } from '@/lib/sheet/sheet-store';
import { financeWallet } from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({
    height: { get: () => 0 },
    state: { get: () => 0 },
  }),
}));
jest.mock('@/lib/supabase/debts', () => ({
  addDebtPrincipal: jest.fn(async () => ({ id: 'activity' })),
  createDebt: jest.fn(async () => ({ id: 'saved' })),
  getDebtById: jest.fn(),
  updateDebt: jest.fn(),
}));
jest.mock('@/lib/toast/toast-store', () => ({ showToast: jest.fn() }));
jest.mock('@/lib/haptics', () => ({
  approve: jest.fn(),
  keypadTap: jest.fn(),
  scrubStep: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

const MAYBANK = '00000000-0000-4000-8000-00000000000a';
const AIMAN = '00000000-0000-4000-8000-0000000000d1';

type PastDebt = {
  id: string;
  name: string;
  direction: 'owed_to_me' | 'i_owe';
  at: string;
  /** Repaid in full, so the debt is settled. */
  settled?: boolean;
};

const AIMAN_OPEN: PastDebt = {
  id: AIMAN,
  name: 'Aiman',
  direction: 'owed_to_me',
  at: '2026-10-01T10:00:00.000Z',
};

function seed(...past: PastDebt[]) {
  const activity = (debt: PastDebt, kind: 'principal' | 'repayment') => ({
    id: `${kind}-${debt.id}`,
    userId: 'user_1',
    debtId: debt.id,
    kind,
    amountMinor: 11000,
    activityDate: debt.at,
    walletId: MAYBANK,
    cashTransactionId: null,
    note: null,
  });
  financeProjection$.set({
    ...EMPTY_FINANCE_PROJECTION,
    walletsById: { [MAYBANK]: financeWallet({ id: MAYBANK }) },
    debtsById: Object.fromEntries(
      past.map((debt) => [
        debt.id,
        {
          id: debt.id,
          userId: 'user_1',
          counterpartyName: debt.name,
          direction: debt.direction,
          currency: 'MYR',
          dueDate: null,
          note: null,
          status: debt.settled ? ('settled' as const) : ('open' as const),
        },
      ]),
    ),
    debtActivitiesById: Object.fromEntries(
      past.flatMap((debt) =>
        (debt.settled ? (['principal', 'repayment'] as const) : (['principal'] as const)).map(
          (kind) => [`${kind}-${debt.id}`, activity(debt, kind)],
        ),
      ),
    ),
  } as typeof EMPTY_FINANCE_PROJECTION);
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const keys = (...digits: string[]) =>
  digits.forEach((digit) => press(`debts.key.${digit}`));

async function record() {
  await act(async () => {
    press('debts.submit');
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

afterEach(() => act(() => dismissSheet()));

const withSheets = () =>
  render(
    <>
      <NewDebtScreen />
      <SheetHost />
    </>,
  );

const sheetRows = () =>
  screen
    .getAllByTestId(/^sheet\.option\./)
    .map((row) => row.props.accessibilityLabel as string);

describe('Record a debt', () => {
  it('records from a name and keys on the one page', async () => {
    render(<NewDebtScreen />);
    expect(screen.getByText('Add who and an amount')).toBeTruthy();
    expect(screen.queryByText('How much?')).toBeNull();

    fireEvent.changeText(screen.getByTestId('debts.new.person'), ' Hana ');
    expect(screen.getByText('Add an amount')).toBeTruthy();

    keys('5', '0');
    expect(screen.getByText('RM50')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('debts.new.note'), ' Lunch ');
    expect(screen.getByText('Record: Hana owes you RM50.00')).toBeTruthy();
    await record();

    expect(jest.mocked(createDebt).mock.calls).toEqual([
      [
        {
          counterpartyName: 'Hana',
          direction: 'owed_to_me',
          amountMinor: 5000,
          walletId: MAYBANK,
          dueDate: null,
          note: 'Lunch',
        },
      ],
    ]);
    expect(jest.mocked(showToast).mock.calls).toEqual([
      [{ text: 'Saved. Hana owes you RM50.00' }],
    ]);
    expect(jest.mocked(router.back).mock.calls).toHaveLength(1);
    expect(jest.mocked(router.push).mock.calls).toEqual([]);
  });

  it('keeps the name in its field and on the button, on both sides', () => {
    render(<NewDebtScreen />);
    fireEvent.changeText(screen.getByTestId('debts.new.person'), 'Hana');
    keys('5');

    expect(screen.getByText('They owe me')).toBeTruthy();
    expect(screen.getByText('I owe them')).toBeTruthy();
    expect(screen.getByText('Lent from')).toBeTruthy();
    expect(screen.getByText('Record: Hana owes you RM5.00')).toBeTruthy();
    expect(screen.queryByTestId('debts.sentence')).toBeNull();
    expect(screen.queryAllByText(/Hana/)).toHaveLength(1);

    press('debts.direction.i-owe');
    expect(screen.getByText('They owe me')).toBeTruthy();
    expect(screen.getByText('I owe them')).toBeTruthy();
    expect(screen.getByText('Borrowed into')).toBeTruthy();
    expect(screen.getByText('Record: you owe Hana RM5.00')).toBeTruthy();
    expect(screen.queryAllByText(/Hana/)).toHaveLength(1);
  });

  it('does nothing until who and an amount are both there', async () => {
    render(<NewDebtScreen />);
    keys('5');
    expect(screen.getByText('Add who and an amount')).toBeTruthy();
    await record();
    expect(jest.mocked(createDebt).mock.calls).toEqual([]);
  });

  it('hides the people button when nobody is on that side', () => {
    seed(AIMAN_OPEN);
    render(<NewDebtScreen />);
    expect(screen.getByTestId('debts.new.people')).toBeTruthy();

    press('debts.direction.i-owe');
    expect(screen.queryByTestId('debts.new.people')).toBeNull();
  });

  it('lists past people for the selected side, newest first, settled too, each name once', async () => {
    seed(
      { id: 'd1', name: 'Bala', direction: 'owed_to_me', at: '2026-08-01T10:00:00.000Z' },
      {
        id: 'd2',
        name: 'Hana',
        direction: 'owed_to_me',
        at: '2026-10-05T10:00:00.000Z',
        settled: true,
      },
      { id: 'd3', name: 'HANA ', direction: 'owed_to_me', at: '2026-07-01T10:00:00.000Z' },
      { id: 'd4', name: 'Mei', direction: 'i_owe', at: '2026-10-20T10:00:00.000Z' },
      { id: 'd5', name: 'Bala', direction: 'i_owe', at: '2026-06-01T10:00:00.000Z' },
      AIMAN_OPEN,
    );
    withSheets();

    await act(async () => press('debts.new.people'));
    expect(screen.getByText('People who owed you')).toBeTruthy();
    expect(sheetRows()).toEqual(['Hana', 'Aiman', 'Bala']);
    await act(async () => dismissSheet());

    press('debts.direction.i-owe');
    await act(async () => press('debts.new.people'));
    expect(screen.getByText('People you owed')).toBeTruthy();
    expect(sheetRows()).toEqual(['Mei', 'Bala']);
  });

  it('picking a past person fills the field, and the open debt note says what it adds to', async () => {
    seed(AIMAN_OPEN);
    const stored = { id: AIMAN, counterpartyName: 'Aiman' };
    jest.mocked(getDebtById).mockResolvedValue(
      stored as Awaited<ReturnType<typeof getDebtById>>,
    );
    withSheets();
    expect(
      screen.getByLabelText('Choose from people who owed you'),
    ).toBeTruthy();

    await act(async () => press('debts.new.people'));
    await act(async () => press('sheet.option.aiman'));

    expect(screen.getByTestId('debts.new.person').props.value).toBe('Aiman');
    expect(
      screen.getByText(
        "Aiman already owes you RM110.00. This goes on Aiman's page too.",
      ),
    ).toBeTruthy();

    keys('2', '5');
    await record();

    expect(jest.mocked(addDebtPrincipal).mock.calls).toEqual([
      [stored, 2500, MAYBANK, null],
    ]);
    expect(jest.mocked(createDebt).mock.calls).toEqual([]);
    expect(jest.mocked(showToast).mock.calls).toEqual([
      [{ text: 'Saved. Aiman owes you RM135.00' }],
    ]);
  });

  it('marks the typed person in the drawer, whatever the case', async () => {
    seed(AIMAN_OPEN);
    withSheets();
    fireEvent.changeText(screen.getByTestId('debts.new.person'), 'aiman');

    await act(async () => press('debts.new.people'));
    expect(
      screen.getByTestId('sheet.option.aiman').props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it('asks for a wallet when the main currency has none', () => {
    financeProjection$.set(EMPTY_FINANCE_PROJECTION);
    render(<NewDebtScreen />);
    fireEvent.changeText(screen.getByTestId('debts.new.person'), 'Hana');
    keys('5');
    expect(screen.getByText('Add a MYR wallet first')).toBeTruthy();
  });
});
