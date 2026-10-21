import type { MinorAmount } from '@repo/types';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { TransactionRow } from '@/components/ui/transaction-row';
import { tid } from '@/lib/test-ids';
import type { TransactionRowData } from '@/lib/transactions/row';

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
        grouped
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
        grouped={false}
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
        grouped={false}
        onPress={() => {}}
        now={now}
      />,
    );
    expect(screen.getByText('RM6.00')).toBeTruthy();
    expect(screen.getByText('To review')).toBeTruthy();
    expect(screen.getByText('Today · no wallet yet')).toBeTruthy();
  });

  it('opens quick actions with the hold, not the detail, from the screen reader action', () => {
    const onPress = jest.fn();
    const onHold = jest.fn();
    render(
      <TransactionRow
        testID={tid('activity', 'row', 'grab')}
        row={grab}
        grouped
        onPress={onPress}
        onHold={onHold}
        now={now}
      />,
    );
    const row = screen.getByTestId('activity.row.grab');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'quickActions', label: 'Quick actions' },
    ]);
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
