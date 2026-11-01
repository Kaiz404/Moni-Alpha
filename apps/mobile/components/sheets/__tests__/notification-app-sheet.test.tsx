import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { getCachedAppIcon } from '@/lib/notifications/app-icon-cache';
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
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      set: (key: string, value: string) => store.set(key, value),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
    }),
  };
});
jest.mock('@/lib/finance/selectors', () => ({ walletBalanceMinor$: () => ({ get: () => 0 }) }));
jest.mock('@/lib/finance/main-currency', () => ({ useMainCurrency: () => 'MYR' }));

const ICON = 'data:image/png;base64,ICON';
const mockNative = {
  available: true,
  listLaunchableAppsAsync: undefined as undefined | jest.Mock,
  getInstalledAppsAsync: jest.fn(async (): Promise<unknown[]> => []),
  getAppInfoAsync: jest.fn(async (): Promise<unknown> => null),
};
jest.mock('../../../modules/moni-android-apps', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
  isMoniAndroidAppsNativeAvailable: () => mockNative.available,
}));

const PHONE = [
  { packageName: 'com.whatsapp', label: 'WhatsApp', iconUri: null },
  { packageName: 'com.example.anybank', label: 'Any Bank', iconUri: ICON },
  { packageName: 'com.anonymous.moni', label: 'Moni', iconUri: null },
];

let os: string;
let onPick: jest.Mock;

function open(selected: string | null = null, selectedLabel: string | null = null) {
  onPick = jest.fn();
  render(
    <NotificationAppSheet
      open
      onDismiss={() => {}}
      onExited={() => {}}
      request={{ selected, selectedLabel }}
      onPick={onPick}
    />,
  );
}

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
});

beforeEach(() => {
  os = 'android';
  mockNative.available = true;
  mockNative.listLaunchableAppsAsync = jest.fn(async () => PHONE);
});

describe('the app sheet', () => {
  it('lists the apps on the phone without Moni, picks one, and keeps its icon', async () => {
    open();
    await act(async () => {});

    expect(screen.getByText('Any Bank')).toBeTruthy();
    expect(screen.getByText('WhatsApp')).toBeTruthy();
    expect(screen.queryByText('Moni')).toBeNull();
    expect(screen.getByText('Moni reads spending alerts only from the app you pick.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('sheet.option.com-example-anybank'));

    expect(onPick).toHaveBeenCalledWith({
      app: { packageName: 'com.example.anybank', label: 'Any Bank' },
    });
    expect(getCachedAppIcon('com.example.anybank')).toBe(ICON);
  });

  it("resolves to no app on Don't link", async () => {
    open('com.example.anybank', 'Any Bank');
    await act(async () => {});

    fireEvent.press(screen.getByTestId('sheet.option.none'));

    expect(onPick).toHaveBeenCalledWith({ app: null });
  });

  it('filters by search, and says so when nothing matches', async () => {
    open();
    await act(async () => {});

    fireEvent.changeText(screen.getByTestId('sheet.search'), 'what');
    expect(screen.getByText('WhatsApp')).toBeTruthy();
    expect(screen.queryByText('Any Bank')).toBeNull();

    fireEvent.changeText(screen.getByTestId('sheet.search'), 'zzz');
    expect(screen.getByText('Nothing matches “zzz”.')).toBeTruthy();
  });

  it('shows the linked app even when the phone no longer lists it', async () => {
    open('com.example.gone', 'Gone Bank');
    await act(async () => {});

    expect(screen.getByText('Gone Bank')).toBeTruthy();
    expect(screen.getByText('Not found on this phone')).toBeTruthy();
  });

  it('says linking is Android only, with no search, on another platform', async () => {
    os = 'ios';
    open();
    await act(async () => {});

    expect(screen.getByText('Linking an app works on Android only.')).toBeTruthy();
    expect(screen.queryByTestId('sheet.search')).toBeNull();
    expect(screen.getByTestId('sheet.option.none')).toBeTruthy();
  });

  it('says a new build is needed when the native module is missing', async () => {
    mockNative.available = false;
    open();
    await act(async () => {});

    expect(screen.getByText('Listing the apps on this phone needs a new build of Moni.')).toBeTruthy();
    expect(screen.getByTestId('sheet.option.none')).toBeTruthy();
  });

  it('says the list is short on a build without the new function, and still works', async () => {
    mockNative.listLaunchableAppsAsync = undefined;
    mockNative.getInstalledAppsAsync.mockResolvedValue([
      { packageName: 'com.maybank2u.life', label: 'MAE', iconUri: null },
    ]);
    open();
    await act(async () => {});

    expect(
      screen.getByText('This build of Moni lists only the finance apps it knows. A new build lists every app.'),
    ).toBeTruthy();
    expect(screen.getByText('MAE')).toBeTruthy();
  });
});
