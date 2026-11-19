import 'react-native-gesture-handler/jestSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DueDaySheet } from '@/components/budget/due-day-sheet';
import { DueDateSheet } from '@/components/debt/due-date-sheet';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({ height: { get: () => 0 }, state: { get: () => 0 } }),
}));

beforeEach(() => {
  jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 9, 14, 12) });
});
afterEach(() => {
  jest.useRealTimers();
});

const pickable = (id: string) => !screen.getByTestId(`sheet.option.${id}`).props.accessibilityState.disabled;

describe('Bill due date', () => {
  it('opens on this month, today to 30 days ahead, and says a monthly bill repeats', () => {
    const onPick = jest.fn();
    render(<DueDaySheet open selected={null} monthly onPick={onPick} onDismiss={jest.fn()} />);
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(pickable('2026-10-13')).toBe(false);
    expect(pickable('2026-10-14')).toBe(true);
    expect(screen.getByText('Repeats every month on this day.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('sheet.page.next'));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(pickable('2026-11-13')).toBe(true);
    expect(pickable('2026-11-14')).toBe(false);
    expect(screen.getByTestId('sheet.page.next').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('sheet.option.2026-11-02'));
    expect(onPick).toHaveBeenCalledWith('2026-11-02');
  });

  it('leaves the repeat line off a one-off bill', () => {
    render(<DueDaySheet open selected="2026-10-20" monthly={false} onPick={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.queryByText('Repeats every month on this day.')).toBeNull();
    expect(screen.getByTestId('sheet.option.2026-10-20').props.accessibilityState.selected).toBe(true);
  });
});

describe('Debt due date', () => {
  it('opens on the month of the date already set and clears it with No date', () => {
    const onPick = jest.fn();
    render(<DueDateSheet open selected="2027-01-15" onPick={onPick} onDismiss={jest.fn()} />);
    expect(screen.getByText('January 2027')).toBeTruthy();
    expect(screen.getByTestId('sheet.option.2027-01-15').props.accessibilityState.selected).toBe(true);

    expect(screen.getByTestId('debts.due.none').props.accessibilityState.selected).toBe(false);

    fireEvent.press(screen.getByTestId('debts.due.none'));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('opens on an overdue date, picked, with only that past day pickable', () => {
    render(<DueDateSheet open selected="2026-08-03" onPick={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText('August 2026')).toBeTruthy();
    expect(screen.getByTestId('sheet.option.2026-08-03').props.accessibilityState.selected).toBe(true);
    expect(pickable('2026-08-03')).toBe(true);
    expect(pickable('2026-08-04')).toBe(false);
    expect(screen.getByTestId('sheet.page.previous').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('sheet.page.next'));
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(pickable('2026-09-30')).toBe(false);
  });

  it('shows No date picked when the debt has none', () => {
    render(<DueDateSheet open selected={null} onPick={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByTestId('debts.due.none').props.accessibilityState.selected).toBe(true);
  });

  it('reaches a year ahead and no further', () => {
    const onPick = jest.fn();
    render(<DueDateSheet open selected={null} onPick={onPick} onDismiss={jest.fn()} />);
    for (let month = 0; month < 12; month++) fireEvent.press(screen.getByTestId('sheet.page.next'));
    expect(screen.getByText('October 2027')).toBeTruthy();
    expect(pickable('2027-10-14')).toBe(true);
    expect(pickable('2027-10-15')).toBe(false);
  });
});
