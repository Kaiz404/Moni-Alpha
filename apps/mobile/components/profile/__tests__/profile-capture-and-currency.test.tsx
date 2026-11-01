import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import ProfileScreen from '@/app/profile';
import { readNotificationListenerPermission } from '@/lib/notifications/permission';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useAnimatedKeyboard: () => ({ height: { get: () => 0 } }),
  };
});
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
  Uniwind: { setTheme: () => {} },
}));
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(effect, [effect]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ set: () => {}, getString: () => undefined, remove: () => {} }),
}));
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'kai@example.com', user_metadata: {}, app_metadata: {} },
    signOut: jest.fn(),
  }),
}));
jest.mock('@/components/profile/export-data-row', () => ({ ExportDataRow: () => null }));
jest.mock('@/components/profile/import-data-row', () => ({ ImportDataRow: () => null }));
jest.mock('@/components/merchants/use-merchant-names', () => ({
  useMerchantNames: () => ({ toName: [], named: [] }),
}));
jest.mock('@/lib/notifications/permission', () => ({
  askForNotificationAccess: jest.fn(),
  openNotificationListenerSettings: jest.fn(),
  readNotificationListenerPermission: jest.fn(),
}));
jest.mock('@/lib/speech/speech-recognition', () => ({ prepareOfflineSpeechModel: jest.fn() }));


jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: async () => ({
    granted: true,
    status: 'granted',
    canAskAgain: true,
  }),
  requestForegroundPermissionsAsync: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: async () => ({ granted: true, status: 'granted', canAskAgain: true }),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    getPermissionsAsync: async () => ({
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
    }),
    requestPermissionsAsync: jest.fn(),
  },
}));

const warningBubbles = () =>
  screen.root.findAll(
    (node) =>
      typeof node.props.className === 'string' &&
      node.props.className.includes('bg-attention-fill'),
    { deep: false },
  );

const OLD_ROWS = ['Bank notifications', 'Location', 'Camera', 'Microphone', 'Set up'];

async function showProfile(listener: 'authorized' | 'denied' | 'unavailable') {
  jest.mocked(readNotificationListenerPermission).mockResolvedValue(listener);
  render(<ProfileScreen />);
  await act(async () => {});
}

beforeEach(() => {
  Platform.OS = 'android';
  jest.mocked(router.push).mockClear();
});

describe('Profile, Capture sources', () => {
  it('is one row that says notifications are on and opens the page', async () => {
    await showProfile('authorized');

    expect(screen.getByText('Capture sources')).toBeTruthy();
    expect(screen.getByText('Notifications on')).toBeTruthy();
    expect(warningBubbles()).toHaveLength(0);
    for (const old of OLD_ROWS) expect(screen.queryByText(old)).toBeNull();

    fireEvent.press(screen.getByTestId('profile.row.capture-sources'));
    expect(router.push).toHaveBeenCalledWith('/capture-sources');
  });

  it('says so when notification access is off', async () => {
    await showProfile('denied');
    expect(screen.getByText('Notifications off')).toBeTruthy();
    expect(warningBubbles()).toHaveLength(1);
  });

  it('counts the other accesses on a phone that cannot read notifications', async () => {
    await showProfile('unavailable');
    expect(screen.getByText('2 on, 1 not set up')).toBeTruthy();
  });

  it('holds the second line while the read is in flight', async () => {
    jest.mocked(readNotificationListenerPermission).mockReturnValue(new Promise(() => {}));
    render(<ProfileScreen />);
    await act(async () => {});
    expect(screen.getByText('Notifications')).toBeTruthy();
  });
});

describe('Profile, Main currency', () => {
  const NOTE =
    'Home, Activity, Budget and Debts show this currency. Other currencies stay on Wallets.';

  it('keeps the description in the sheet, not under the row', async () => {
    await showProfile('authorized');
    expect(screen.queryByText(NOTE)).toBeNull();

    fireEvent.press(screen.getByTestId('profile.main-currency'));
    expect(screen.getByText(NOTE)).toBeTruthy();
  });
});
