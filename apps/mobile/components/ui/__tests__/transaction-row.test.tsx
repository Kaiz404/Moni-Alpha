import type { MinorAmount } from '@repo/types';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { TransactionRow } from '@/components/ui/transaction-row';
import { holdCommit } from '@/lib/haptics';
import { tid } from '@/lib/test-ids';
import type { TransactionRowData } from '@/lib/transactions/row';

jest.mock('@/lib/haptics', () => ({ holdCommit: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const grab: TransactionRowData = {
  kind: 'expense',
  title: 'GRAB*FOOD',
  date: new Date(2026, 9, 14, 12, 41).toISOString(),
  amountMinor: 4590 as MinorAmount,
  currency: 'MYR',
  icon: 'food',
  color: '#F1A399',
  category: 'Food & Dining',
  wallet: 'Maybank',
  autoAdded: false,
};
const now = new Date(2026, 9, 14, 14, 6);

describe('TransactionRow', () => {
  it('shows an expense with a U+2212 minus and the day-grouped meta', () => {
    const onPress = jest.fn();
    render(
      <TransactionRow
        testID={tid('activity', 'row', 'grab')}
        row={grab}
        metaLead="category"
        onPress={onPress}
        now={now}
      />,
    );
    expect(screen.getByText('−RM45.90')).toBeTruthy();
    expect(screen.getByText('Food & Dining · Maybank')).toBeTruthy();
    fireEvent.press(screen.getByTestId('activity.row.grab'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('leads an auto-added row with the Auto pill and dates it outside day groups', () => {
    render(
      <TransactionRow
        testID={tid('home', 'recent', 'row', 'grab')}
        row={{ ...grab, autoAdded: true }}
        metaLead="date"
        onPress={() => {}}
        now={now}
      />,
    );
    expect(screen.getByText('Auto')).toBeTruthy();
    expect(screen.getByText('Today · Maybank')).toBeTruthy();
  });

  it('shows a pending capture unsigned with To review and no wallet yet', () => {
    render(
      <TransactionRow
        testID={tid('activity', 'row', 'parking')}
        row={{
          kind: 'pending',
          title: 'Parking KLCC',
          date: grab.date,
          amountMinor: 600 as MinorAmount,
          currency: 'MYR',
          icon: 'car',
          color: null,
          category: 'Transport',
          wallet: null,
        }}
        metaLead="date"
        onPress={() => {}}
        now={now}
      />,
    );
    expect(screen.getByText('RM6.00')).toBeTruthy();
    expect(screen.getByText('To review')).toBeTruthy();
    expect(screen.getByText('Today · no wallet yet')).toBeTruthy();
  });
});

describe('TransactionRow hold', () => {
  const touch = (pageX: number) => ({
    nativeEvent: { pageX, pageY: 300 },
  });

  function renderHoldable() {
    const onPress = jest.fn();
    render(
      <TransactionRow
        testID={tid('activity', 'row', 'grab')}
        row={grab}
        metaLead="category"
        onPress={onPress}
        onHold={() => {}}
        now={now}
      />,
    );
    return { onPress, row: screen.getByTestId('activity.row.grab') };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(holdCommit).mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('offers Quick actions to the screen reader', () => {
    const { row } = renderHoldable();
    expect(row.props.accessibilityActions).toEqual([
      { name: 'quickActions', label: 'Quick actions' },
    ]);
  });

  it('opens the detail on a release inside 250 ms', () => {
    const { onPress, row } = renderHoldable();
    fireEvent(row, 'pressIn', touch(100));
    jest.advanceTimersByTime(120);
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('opens nothing on a release after the bloom starts', () => {
    const { onPress, row } = renderHoldable();
    fireEvent(row, 'pressIn', touch(100));
    jest.advanceTimersByTime(300);
    fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('cancels the hold when the finger drifts past 10 px', () => {
    const { onPress, row } = renderHoldable();
    fireEvent(row, 'pressIn', touch(100));
    fireEvent(row, 'touchMove', touch(112));
    fireEvent(row, 'longPress');
    fireEvent.press(row);
    expect(holdCommit).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('commits with the Confirm haptic at 500 ms', () => {
    const { row } = renderHoldable();
    fireEvent(row, 'pressIn', touch(100));
    fireEvent(row, 'longPress');
    expect(holdCommit).toHaveBeenCalledTimes(1);
  });
});
