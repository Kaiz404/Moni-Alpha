import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { RangeSheet } from '@/components/activity/range-sheet';
import { pickActivityRange } from '@/lib/sheet/pick-date';
import { dismissSheet, getOpenSheet } from '@/lib/sheet/sheet-store';

jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/components/ui/sheet/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => children,
}));

const frame = { open: true, onDismiss: jest.fn(), onExited: jest.fn() };
const open = DateTimePickerAndroid.open as jest.Mock;
const october = { from: '2026-10-01', to: '2026-10-14' };

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 14, 12), doNotFake: ['nextTick', 'setImmediate'] });
  open.mockReset();
  Platform.OS = 'android';
});
afterEach(() => {
  dismissSheet();
  jest.useRealTimers();
});

describe('RangeSheet', () => {
  it('applies a preset at once', () => {
    const onPick = jest.fn();
    render(<RangeSheet {...frame} request={{ range: null }} onPick={onPick} />);
    fireEvent.press(screen.getByTestId('sheet.range.last-month'));
    expect(onPick).toHaveBeenCalledWith({ range: { from: '2026-09-01', to: '2026-09-30' } });
  });

  it('applies All time as no dates', () => {
    const onPick = jest.fn();
    render(<RangeSheet {...frame} request={{ range: october }} onPick={onPick} />);
    fireEvent.press(screen.getByTestId('sheet.range.all-time'));
    expect(onPick).toHaveBeenCalledWith({ range: null });
  });

  it('marks the preset the dates already match', () => {
    render(
      <RangeSheet
        {...frame}
        request={{ range: { from: '2026-10-01', to: '2026-10-31' } }}
        onPick={jest.fn()}
      />,
    );
    expect(screen.getByTestId('sheet.range.this-month').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('sheet.range.all-time').props.accessibilityState.selected).toBe(false);
  });

  it('opens at the start of this month to today when no dates are set', () => {
    const onPick = jest.fn();
    render(<RangeSheet {...frame} request={{ range: null }} onPick={onPick} />);
    fireEvent.press(screen.getByTestId('sheet.range.apply'));
    expect(onPick).toHaveBeenCalledWith({ range: october });
  });

  it('picks From in the system calendar and swaps reversed ends', async () => {
    const onPick = jest.fn();
    render(<RangeSheet {...frame} request={{ range: october }} onPick={onPick} />);
    fireEvent.press(screen.getByTestId('sheet.range.from'));
    await act(async () => {
      open.mock.calls[0][0].onChange({ type: 'set' }, new Date(2026, 9, 20, 12));
    });
    fireEvent.press(screen.getByTestId('sheet.range.apply'));
    expect(onPick).toHaveBeenCalledWith({ range: { from: '2026-10-14', to: '2026-10-20' } });
  });

  it('keeps the days when the calendar is dismissed', async () => {
    const onPick = jest.fn();
    render(<RangeSheet {...frame} request={{ range: october }} onPick={onPick} />);
    fireEvent.press(screen.getByTestId('sheet.range.to'));
    await act(async () => {
      open.mock.calls[0][0].onChange({ type: 'dismissed' });
    });
    fireEvent.press(screen.getByTestId('sheet.range.apply'));
    expect(onPick).toHaveBeenCalledWith({ range: october });
  });

  it('hands the end back to its caller where the date picker is a sheet', () => {
    Platform.OS = 'ios';
    const onPick = jest.fn();
    render(<RangeSheet {...frame} request={{ range: october }} onPick={onPick} />);
    fireEvent.press(screen.getByTestId('sheet.range.to'));
    expect(onPick).toHaveBeenCalledWith({ editing: 'to', draft: october });
  });
});

describe('pickActivityRange where the date picker is a sheet', () => {
  const settle = async (result: unknown) => {
    await act(async () => {
      (getOpenSheet() as unknown as { settle: (value: unknown) => void }).settle(result);
    });
  };

  it('reopens with the picked day, swapped if reversed, and resolves the dates', async () => {
    Platform.OS = 'ios';
    const picked = pickActivityRange(october);
    expect(getOpenSheet()).toMatchObject({ kind: 'activityRange', request: { range: october } });
    await settle({ editing: 'from', draft: october });
    expect(getOpenSheet()?.kind).toBe('date');
    await settle('2026-10-20');
    expect(getOpenSheet()).toMatchObject({
      kind: 'activityRange',
      request: { range: { from: '2026-10-14', to: '2026-10-20' } },
    });
    await settle({ range: { from: '2026-10-14', to: '2026-10-20' } });
    await expect(picked).resolves.toEqual({ range: { from: '2026-10-14', to: '2026-10-20' } });
  });

  it('resolves null when dismissed', async () => {
    const picked = pickActivityRange(null);
    await settle(null);
    await expect(picked).resolves.toBeNull();
  });
});
