import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { TabBar, TABS } from '@/components/nav/tab-bar';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 48,
    bottom: 24,
    left: 0,
    right: 0,
  }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const names = ['index', 'activity', 'budget', 'debts'];

function renderBar(focused: number) {
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  const props = {
    state: {
      index: focused,
      routes: names.map((name) => ({ key: `${name}-key`, name })),
    },
    navigation,
  } as unknown as BottomTabBarProps;
  render(<TabBar {...props} />);
  return navigation;
}

describe('TabBar', () => {
  it('reads Home, Activity, Add a transaction, Budget, Debts in order', () => {
    renderBar(0);
    expect(
      screen
        .getAllByRole(/tab|button/)
        .map((node) => node.props.accessibilityLabel),
    ).toEqual([
      'Home',
      'Activity',
      'Add a transaction',
      'Budget',
      'Debts',
    ]);
  });

  it('marks only the open tab selected', () => {
    renderBar(2);
    expect(
      screen.getByTestId('nav.tab.budget').props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId('nav.tab.index').props.accessibilityState,
    ).toEqual({ selected: false });
  });

  it('navigates to a tab that is not open', () => {
    const navigation = renderBar(0);
    fireEvent.press(screen.getByTestId('nav.tab.debts'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'debts',
      undefined,
    );
  });

  it('does not navigate when the open tab is pressed again', () => {
    const navigation = renderBar(1);
    fireEvent.press(screen.getByTestId('nav.tab.activity'));
    expect(navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'activity-key',
      canPreventDefault: true,
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('owns its URL: no root folder index shares a tab name', () => {
    const app = join(__dirname, '../../../app');
    expect(
      TABS.filter(
        (tab) =>
          tab.name !== 'index' &&
          (existsSync(join(app, tab.name, 'index.tsx')) ||
            existsSync(join(app, `${tab.name}.tsx`))),
      ).map((tab) => tab.name),
    ).toEqual([]);
  });
});
