import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DebtHistory } from '@/components/debt/debt-history';
import { InPlaceGroup } from '@/components/ui/in-place-field';
import { financeProjection$ } from '@/lib/finance/projection';
import { editDebtActivityAmount } from '@/lib/supabase/debts';
import { dismissToast } from '@/lib/toast/toast-store';
import { EMPTY_FINANCE_PROJECTION, type FinanceDebt, type FinanceDebtActivity } from '@repo/core';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/components/ui/page', () => ({
  usePageLift: () => ({ current: () => 0, to: () => {} }),
}));
jest.mock('@/lib/supabase/debts', () => ({ editDebtActivityAmount: jest.fn(() => () => {}) }));
jest.mock('@/lib/store', () => ({}));

const DEBT: FinanceDebt = {
  id: 'debt-1',
  userId: 'kai',
  counterpartyName: 'Aiman',
  direction: 'owed_to_me',
  currency: 'MYR',
  dueDate: null,
  note: null,
  status: 'open',
};

const entry = (id: string, kind: FinanceDebtActivity['kind'], amountMinor: number) =>
  ({
    id,
    userId: 'kai',
    debtId: 'debt-1',
    kind,
    amountMinor,
    activityDate: '2026-10-01T06:00:00.000Z',
    walletId: null,
    cashTransactionId: null,
    note: null,
  }) as FinanceDebtActivity;

const history = (activities: FinanceDebtActivity[]) =>
  render(
    <InPlaceGroup>
      <DebtHistory
        debt={DEBT}
        activities={activities}
      />
    </InPlaceGroup>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  financeProjection$.set(EMPTY_FINANCE_PROJECTION);
});
afterEach(() => act(() => dismissToast()));

describe('DebtHistory', () => {
  it('edits what was lent in place, through the debt', () => {
    history([entry('a2', 'repayment', 2500), entry('a1', 'principal', 10000)]);
    fireEvent.press(screen.getByTestId('debts.history.a1.edit'));
    fireEvent.changeText(screen.getByTestId('debts.history.a1.input'), '120');
    fireEvent.press(screen.getByTestId('debts.history.a1.save'));
    expect(jest.mocked(editDebtActivityAmount).mock.calls).toEqual([[DEBT, 'a1', 12000]]);
  });

  it('keeps a written-off debt read only', () => {
    history([entry('a3', 'write_off', 10000), entry('a1', 'principal', 10000)]);
    expect(screen.queryByTestId('debts.history.a1.edit')).toBeNull();
    expect(screen.queryByTestId('debts.history.a3.edit')).toBeNull();
  });
});
