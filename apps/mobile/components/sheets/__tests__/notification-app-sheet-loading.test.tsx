import 'react-native-gesture-handler/jestSetup';
import { act, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { NotificationAppSheet } from '../option-picker-sheet';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({
    height: { get: () => 0 },
    state: { get: () => 0 },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ set: jest.fn(), getString: jest.fn(), remove: jest.fn() }),
}));
jest.mock('@/lib/finance/selectors', () => ({ walletBalanceMinor$: () => ({ get: () => 0 }) }));
jest.mock('@/lib/finance/main-currency', () => ({ useMainCurrency: () => 'MYR' }));

const PHONE = [{ packageName: 'com.example.anybank', label: 'Any Bank', iconUri: null }];
let mockAnswer: (apps: typeof PHONE) => void = () => {};
jest.mock('../../../modules/moni-android-apps', () => ({
  __esModule: true,
  default: {
    listLaunchableAppsAsync: () => new Promise((resolve) => (mockAnswer = resolve)),
  },
  isMoniAndroidAppsNativeAvailable: () => true,
}));

// Its own file: the listing is kept for the life of the process, and this needs none yet.
it('keeps the search and the way out while the phone answers, then shows the apps', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  render(
    <NotificationAppSheet
      open
      onDismiss={() => {}}
      onExited={() => {}}
      request={{ selected: null }}
      onPick={() => {}}
    />,
  );

  expect(screen.getByText('Looking for the apps on this phone')).toBeTruthy();
  expect(screen.getByTestId('sheet.search')).toBeTruthy();
  expect(screen.getByTestId('sheet.option.none')).toBeTruthy();

  await act(async () => mockAnswer(PHONE));

  expect(screen.getByText('Any Bank')).toBeTruthy();
  expect(screen.queryByText('Looking for the apps on this phone')).toBeNull();
});
