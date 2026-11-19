import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { BirthMonthField, type BirthPick } from '@/components/auth/birth-month-field';
import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { dismissSheet } from '@/lib/sheet/sheet-store';

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

afterEach(async () => {
  act(() => dismissSheet());
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
});

function renderField(value: BirthPick) {
  const onChange = jest.fn();
  render(
    <>
      <BirthMonthField value={value} onChange={onChange} thisYear={2026} />
      <SheetHost />
    </>,
  );
  return onChange;
}

describe('BirthMonthField', () => {
  it('picks a month from a grid of twelve', async () => {
    const onChange = renderField({ month: null, year: 1990 });
    fireEvent.press(screen.getByTestId('auth.birth.month'));
    expect(screen.getByText('Birth month')).toBeTruthy();
    expect(screen.getAllByRole('radio').map((cell) => cell.props.accessibilityLabel)).toEqual([
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]);

    fireEvent.press(screen.getByTestId('sheet.option.4'));
    await act(async () => {});
    expect(onChange).toHaveBeenCalledWith({ month: 4, year: 1990 });
  });

  it('opens the years on the 2000s, the decade of an 18-year-old, and pages to another decade', async () => {
    const onChange = renderField({ month: 4, year: null });
    fireEvent.press(screen.getByTestId('auth.birth.year'));
    expect(screen.getByText('2000s')).toBeTruthy();
    expect(screen.queryByTestId('sheet.option.2010')).toBeNull();

    fireEvent.press(screen.getByTestId('sheet.page.next'));
    expect(screen.getByText('2010s')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet.option.2010'));
    await act(async () => {});
    expect(onChange).toHaveBeenCalledWith({ month: 4, year: 2010 });
  });

  it('opens on the decade of the year already picked', () => {
    renderField({ month: 4, year: 1987 });
    fireEvent.press(screen.getByTestId('auth.birth.year'));
    expect(screen.getByText('1980s')).toBeTruthy();
    expect(screen.getByTestId('sheet.option.1987').props.accessibilityState).toEqual({ selected: true, disabled: false });
  });
});
