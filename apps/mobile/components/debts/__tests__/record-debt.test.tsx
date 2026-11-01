import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import NewDebtScreen from '@/app/debt/new';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION } from '@/lib/finance/types';
import {
  addDebtPrincipal,
  createDebt,
  getDebtById,
} from '@/lib/supabase/debts';
import { showToast } from '@/lib/toast/toast-store';
import { financeWallet } from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
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

function seed({ withAiman = false } = {}) {
  financeProjection$.set({
    ...EMPTY_FINANCE_PROJECTION,
    walletsById: { [MAYBANK]: financeWallet({ id: MAYBANK }) },
    ...(withAiman
      ? {
          debtsById: {
            [AIMAN]: {
              id: AIMAN,
              userId: 'user_1',
              counterpartyName: 'Aiman',
              direction: 'owed_to_me' as const,
              currency: 'MYR',
              dueDate: null,
              note: null,
              status: 'open' as const,
            },
          },
          debtActivitiesById: {
            principal: {
              id: 'principal',
              userId: 'user_1',
              debtId: AIMAN,
              kind: 'principal' as const,
              amountMinor: 11000,
              activityDate: '2026-10-01T10:00:00.000Z',
              walletId: MAYBANK,
              cashTransactionId: null,
              note: null,
            },
          },
        }
      : {}),
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

describe('Record a debt', () => {
  it('records from a name and keys on the one page', async () => {
    render(<NewDebtScreen />);
    expect(screen.getByText('Add who and an amount')).toBeTruthy();
    expect(screen.getByText('How much?')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('debts.new.person'), ' Hana ');
    expect(screen.getByText('Add an amount')).toBeTruthy();
    expect(screen.getByText('Hana owes me')).toBeTruthy();

    keys('5', '0');
    expect(screen.getByText('RM50')).toBeTruthy();
    expect(screen.getByText('Hana will owe you RM50.00')).toBeTruthy();

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

  it('does nothing until who and an amount are both there', async () => {
    render(<NewDebtScreen />);
    keys('5');
    expect(screen.getByText('They will owe you RM5.00')).toBeTruthy();
    await record();
    expect(jest.mocked(createDebt).mock.calls).toEqual([]);

    press('debts.direction.i-owe');
    expect(screen.getByText('You will owe them RM5.00')).toBeTruthy();
  });

  it('adds to the open debt of a recent person and hides the chips once named', async () => {
    seed({ withAiman: true });
    const stored = { id: AIMAN, counterpartyName: 'Aiman' };
    jest.mocked(getDebtById).mockResolvedValue(
      stored as Awaited<ReturnType<typeof getDebtById>>,
    );
    render(<NewDebtScreen />);

    press('debts.new.recent.aiman');
    expect(screen.queryByTestId('debts.new.recent.aiman')).toBeNull();
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

  it('asks for a wallet when the main currency has none', () => {
    financeProjection$.set(EMPTY_FINANCE_PROJECTION);
    render(<NewDebtScreen />);
    fireEvent.changeText(screen.getByTestId('debts.new.person'), 'Hana');
    keys('5');
    expect(screen.getByText('Add a MYR wallet first')).toBeTruthy();
  });
});
