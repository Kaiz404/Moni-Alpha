import 'react-native-gesture-handler/jestSetup';
import { render, screen } from '@testing-library/react-native';

import { GridPickerSheet } from '@/components/sheets/grid-picker-sheet';
import { monthGrid, yearMonthGrid } from '@/lib/dates/grid-pages';

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

const sheet = { open: true, onDismiss: jest.fn(), onPick: jest.fn(), startPage: 0 };

describe('GridPickerSheet', () => {
  it('names the year of Choose month when every month is in one year, with no arrows', () => {
    render(
      <GridPickerSheet
        {...sheet}
        title="Choose month"
        layout={yearMonthGrid('2026-07', '2026-11')}
        selectedId="2026-11"
      />,
    );
    expect(screen.getByRole('header', { name: '2026' })).toBeTruthy();
    expect(screen.queryByTestId('sheet.page.previous')).toBeNull();
    expect(screen.queryByTestId('sheet.page.next')).toBeNull();
  });

  it('draws no page header over the birth month grid, which names no year', () => {
    render(
      <GridPickerSheet
        {...sheet}
        title="Birth month"
        layout={monthGrid()}
        selectedId={null}
      />,
    );
    expect(screen.queryByRole('header', { name: '' })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(12);
  });
});
