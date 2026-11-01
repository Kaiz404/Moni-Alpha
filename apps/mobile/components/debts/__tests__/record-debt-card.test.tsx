import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import DebtsScreen from '@/app/(tabs)/debts';
import { useDebtSummary } from '@/components/debts/use-debts';

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
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/providers/sync-banner', () => ({ SyncBanner: () => null }));
jest.mock('@/components/debts/net-position', () => ({
  NetPosition: () => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>Overall, you are owed</MockText>;
  },
}));
jest.mock('@/components/debts/coming-up', () => ({
  ComingUp: () => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>Coming up</MockText>;
  },
}));
jest.mock('@/components/debts/person-row', () => ({ PersonRow: () => null }));
jest.mock('@/components/debts/settled-list', () => ({ SettledList: () => null }));
jest.mock('@/components/debts/use-debts', () => ({ useDebtSummary: jest.fn() }));

function order(): string[] {
  const seen: string[] = [];
  for (const node of screen.UNSAFE_getAllByType(Text)) {
    const words = String(node.props.children);
    if (['Overall, you are owed', 'Record a debt', 'Coming up'].includes(words) && !seen.includes(words))
      seen.push(words);
  }
  return seen;
}

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  jest.mocked(useDebtSummary).mockReturnValue({
    comingUp: [],
    closed: [],
    open: [{ debt: { id: 'mei', direction: 'i_owe' } }],
  } as never);
});

describe('Record a debt on the Debts tab', () => {
  it('sits right under the overall card and opens the new debt page', () => {
    render(<DebtsScreen />);
    expect(order()).toEqual(['Overall, you are owed', 'Record a debt', 'Coming up']);
    const card = screen.getByTestId('debts.record-debt');
    expect(within(card).getByText('Record a debt')).toBeTruthy();
    fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith('/debt/new');
  });

  it('gives way to the empty tile, which has its own button', () => {
    jest.mocked(useDebtSummary).mockReturnValue({ comingUp: [], closed: [], open: [] } as never);
    render(<DebtsScreen />);
    expect(screen.queryByTestId('debts.record-debt')).toBeNull();
    fireEvent.press(screen.getByTestId('debts.empty.record-debt'));
    expect(router.push).toHaveBeenCalledWith('/debt/new');
  });
});
