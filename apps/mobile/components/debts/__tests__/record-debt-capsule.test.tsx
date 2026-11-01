import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import DebtsScreen from '@/app/(tabs)/debts';
import { plusTop, tabBarBottom, TAB_BAR_REACH } from '@/components/nav/plus-button';
import { useDebtSummary } from '@/components/debts/use-debts';

let mockInsetBottom = 0;

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useScrollToTop: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: mockInsetBottom, left: 0, right: 0 }),
}));
jest.mock('@/components/providers/sync-banner', () => ({ SyncBanner: () => null }));
jest.mock('@/components/debts/net-position', () => ({ NetPosition: () => null }));
jest.mock('@/components/debts/coming-up', () => ({ ComingUp: () => null }));
jest.mock('@/components/debts/person-row', () => ({ PersonRow: () => null }));
jest.mock('@/components/debts/settled-list', () => ({ SettledList: () => null }));
jest.mock('@/components/debts/use-debts', () => ({ useDebtSummary: jest.fn() }));

const SUMMARY = {
  comingUp: [],
  closed: [],
  open: [{ debt: { id: 'mei', direction: 'i_owe' } }],
};

function positioned(node: ReactTestInstance): { bottom: number } {
  let current: ReactTestInstance | null = node;
  while (current) {
    const style = StyleSheet.flatten(current.props.style);
    if (typeof style?.bottom === 'number') return { bottom: style.bottom };
    current = current.parent;
  }
  throw new Error('nothing above the capsule sets bottom');
}

beforeEach(() => {
  mockInsetBottom = 0;
  jest.mocked(router.push).mockClear();
  jest.mocked(useDebtSummary).mockReturnValue(SUMMARY as never);
});

describe('Record a debt on the Debts tab', () => {
  it('floats above the ring around the + and opens the new debt page', () => {
    render(<DebtsScreen />);

    const capsule = screen.getByTestId('debts.record-debt');
    const ringTop = tabBarBottom(0) + TAB_BAR_REACH;
    expect(positioned(capsule).bottom).toBe(120);
    expect(ringTop).toBe(112);
    expect(plusTop(0)).toBe(106);

    fireEvent.press(capsule);
    expect(router.push).toHaveBeenCalledWith('/debt/new');
  });

  it('rises with a taller system nav bar', () => {
    mockInsetBottom = 48;
    render(<DebtsScreen />);
    expect(positioned(screen.getByTestId('debts.record-debt')).bottom).toBe(150);
  });

  it('leaves scroll room so the last row clears it', () => {
    render(<DebtsScreen />);
    expect(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).toEqual({
      paddingBottom: 184,
    });
  });

  it('hides when the empty tile has its own button', () => {
    jest.mocked(useDebtSummary).mockReturnValue({ comingUp: [], closed: [], open: [] } as never);
    render(<DebtsScreen />);

    expect(screen.queryByTestId('debts.record-debt')).toBeNull();
    expect(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).toEqual({
      paddingBottom: 120,
    });
    fireEvent.press(screen.getByTestId('debts.empty.record-debt'));
    expect(router.push).toHaveBeenCalledWith('/debt/new');
  });
});
