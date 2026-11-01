import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import {
  fakeFetch,
  id,
  serve,
  sessionStorageEntry,
  SilentWebSocket,
  systemCategoryId,
  type Profile,
} from './support/fake-backend';

// Before the imports below: supabase-js picks up fetch when the app's client module loads.
global.fetch = fakeFetch as typeof fetch;
(global as unknown as { WebSocket: unknown }).WebSocket = SilentWebSocket;

/* eslint-disable import/first */
import { act, cleanup, renderRouter, screen } from 'expo-router/testing-library';

import { authMMKV } from '@/lib/mmkv/auth';
import { clearStore } from '@/lib/store';
/* eslint-enable import/first */

let mockTheme: 'light' | 'dark' = 'light';

// expo-router's testing library swaps in Reanimated's bare mock, which lacks these two.
Object.assign(jest.requireMock('react-native-reanimated'), {
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({
    height: { get: () => 0, value: 0 },
    state: { get: () => 0, value: 0 },
  }),
});

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'android',
    Version: 35,
    isTV: false,
    isTesting: true,
    constants: { reactNativeVersion: { major: 0, minor: 86, patch: 0 } },
    select: (spec: Record<string, unknown>) =>
      'android' in spec ? spec.android : 'native' in spec ? spec.native : spec.default,
  },
}));
jest.mock('../global.css', () => ({}));
// Uniwind's stylesheet is a Metro build product. The token values are the real generated ones.
jest.mock('uniwind', () => {
  const { darkThemeTokens, lightThemeTokens } = jest.requireActual(
    '@/constants/theme-tokens.generated',
  );
  return {
    useCSSVariable: (names: string[]) =>
      names.map(
        (name) =>
          (mockTheme === 'dark' ? darkThemeTokens : lightThemeTokens)[name.replace('--color-', '')],
      ),
    useUniwind: () => ({ theme: mockTheme, hasAdaptiveThemes: false }),
    withUniwind: <T,>(component: T) => component,
    Uniwind: { setTheme: () => {} },
  };
});
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: () => {},
    signOut: async () => null,
    hasPlayServices: async () => true,
  },
  isCancelledResponse: () => false,
  isErrorWithCode: () => false,
  isSuccessResponse: () => true,
  statusCodes: {},
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  cancelAllScheduledNotificationsAsync: async () => {},
  cancelScheduledNotificationAsync: async () => {},
  dismissNotificationAsync: async () => {},
  getAllScheduledNotificationsAsync: async () => [],
  getLastNotificationResponseAsync: async () => null,
  getLastNotificationResponse: () => null,
  getPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  requestPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  scheduleNotificationAsync: async () => 'scheduled',
  setNotificationCategoryAsync: async () => {},
  setNotificationChannelAsync: async () => {},
  setNotificationHandler: () => {},
  useLastNotificationResponse: () => null,
}));
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  const { createElement, forwardRef } = jest.requireActual('react');
  const nativeView = (name: string) =>
    forwardRef(function NativeMapView(
      { children, testID }: { children?: unknown; testID?: string },
      _ref: unknown,
    ) {
      return createElement(View, { testID: testID ?? name }, children);
    });
  return {
    __esModule: true,
    default: nativeView('map-view'),
    Marker: nativeView('map-marker'),
    PROVIDER_GOOGLE: 'google',
  };
});
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, Low: 2 },
  PermissionStatus: { DENIED: 'denied', GRANTED: 'granted', UNDETERMINED: 'undetermined' },
  getForegroundPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  requestForegroundPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  getLastKnownPositionAsync: async () => null,
  getCurrentPositionAsync: async () => ({ coords: { latitude: 3.13, longitude: 101.67 } }),
  reverseGeocodeAsync: async () => [],
  useForegroundPermissions: () => [
    { granted: true, status: 'granted' },
    async () => ({ granted: true }),
  ],
}));
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: () => {},
    stop: () => {},
    abort: () => {},
    getPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
    requestPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
    getSupportedLocales: async () => ({ locales: [], installedLocales: [] }),
    isRecognitionAvailable: () => true,
    supportsOnDeviceRecognition: () => true,
    androidTriggerOfflineModelDownload: async () => ({ status: 'opened_dialog' }),
    addListener: () => ({ remove: () => {} }),
  },
  useSpeechRecognitionEvent: () => {},
}));
jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    start: async () => {},
    stop: async () => {},
    isRunning: () => false,
    updateNotification: async () => {},
  },
}));
// The scanner is a full-screen native activity: while it is open the page below just waits.
jest.mock('moni-document-scanner', () => ({ scanDocument: () => new Promise(() => {}) }));
jest.mock('../modules/moni-android-apps', () => ({
  __esModule: true,
  default: { getInstalledApps: async () => [], getInstalledFinanceApps: async () => [] },
  isMoniAndroidAppsNativeAvailable: () => true,
}));
jest.mock('react-native-android-notification-listener', () => ({
  __esModule: true,
  default: { getPermissionStatus: async () => 'authorized', requestPermission: () => {} },
  RNAndroidNotificationListenerHeadlessJsName: 'RNAndroidNotificationListenerHeadlessJs',
}));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  getCameraPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  requestCameraPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  getMediaLibraryPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  launchCameraAsync: async () => ({ canceled: true, assets: null }),
  launchImageLibraryAsync: async () => ({ canceled: true, assets: null }),
}));
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true, type: 'WIFI' }),
  getNetworkStateAsync: async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'WIFI',
  }),
}));

const APP_DIR = join(__dirname, '..', 'app');

function discoverRouteFiles(dir = APP_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return discoverRouteFiles(path);
    return /\.tsx?$/.test(entry.name) ? [relative(APP_DIR, path).split(sep).join('/')] : [];
  });
}

type Visit = { href: string; text: string };
type RouteSpec = {
  /** Mounted before the first pull lands, so one mount walks an undefined store, then rows. */
  seeded: Visit;
  /** A new account: system categories only, no wallets. */
  empty: Visit;
  signedOut?: true;
};

const WALLET = id('wallet', 'maybank');
const MEI = id('debt', 'mei');
const FOOD = systemCategoryId('Food & Dining');
const BANGSAR = '3.1300,101.6710';
const NETFLIX = encodeURIComponent('MYR|expense|netflix');
const SALARY = id('transaction', 'sample-1');
const same = (href: string, text: string): Pick<RouteSpec, 'seeded' | 'empty'> => ({
  seeded: { href, text },
  empty: { href, text },
});
const differ = (href: string, seeded: string, empty: string): Pick<RouteSpec, 'seeded' | 'empty'> => ({
  seeded: { href, text: seeded },
  empty: { href, text: empty },
});

/** Every route file in app/. A new route without a row here fails the first test below. */
const ROUTES: Record<string, RouteSpec> = {
  '(auth)/login.tsx': { ...same('/login', 'Welcome back'), signedOut: true },
  '(tabs)/index.tsx': differ('/', 'Netflix RM54.90 is due tomorrow', 'Let Moni read bank alerts'),
  '(tabs)/activity.tsx': differ('/activity', 'Food & Dining · Cash', 'No spending yet'),
  '(tabs)/budget.tsx': differ('/budget', 'RM200.80 due by 31 Oct', 'Start with one wallet'),
  '(tabs)/debts.tsx': differ('/debts', 'Pay Mei RM40', 'No debts yet'),
  '+not-found.tsx': same('/no-such-page', 'This screen moved'),
  'bill/[seriesKey].tsx': differ(
    `/bill/${NETFLIX}`,
    'Stop tracking Netflix',
    "This bill isn't due this month",
  ),
  'bill/new.tsx': same('/bill/new', 'How much is it each time?'),
  'budget/[categoryId].tsx': differ(`/budget/${FOOD}`, 'of RM450', 'No budget for Food & Dining'),
  'budget/edit.tsx': same('/budget/edit', 'Monthly total'),
  'budget/list.tsx': same('/budget/list', 'Monthly total'),
  'capture-log.tsx': same('/capture-log', 'Nothing captured yet'),
  'capture-sources.tsx': differ(
    '/capture-sources',
    'Pins payments · Maybank Savings',
    'Link a banking app on a wallet page',
  ),
  'capture/say.tsx': same('/capture/say', 'Say the shop, the amount and how you paid.'),
  'capture/scan.tsx': same('/capture/scan', 'Scan a receipt'),
  'categories/form.tsx': same('/categories/form', 'Give it a name to save'),
  'categories/index.tsx': differ(
    '/categories',
    'Custom · RM235.30 since 1 Oct',
    "Make one for anything the presets don't fit",
  ),
  'chat.tsx': same('/chat', "Hi. Tell me what you spent and I'll file it."),
  'chat/history.tsx': same('/chat/history', 'No past days yet'),
  'debt/[id].tsx': differ(`/debt/${MEI}`, 'You owe Mei', "This debt isn't here any more"),
  'debt/amount.tsx': differ(
    `/debt/amount?id=${MEI}`,
    'Pay Mei back',
    "This debt isn't here any more",
  ),
  'debt/new.tsx': differ('/debt/new', 'Add who and an amount', 'Add a MYR wallet first'),
  'debug/index.tsx': same('/debug', 'Debug tools'),
  'map.tsx': same('/map', 'Where you spend'),
  'merchants.tsx': differ(
    '/merchants',
    'To name · 1',
    'Nothing to name. Moni lists a code here once it shows up 3 times.',
  ),
  'place/[id].tsx': differ(`/place/${BANGSAR}`, 'Bangsar', 'Nothing here in this range'),
  'profile.tsx': differ('/profile', '3 in ringgit · 1 in US dollars', 'Malaysian ringgit'),
  'review.tsx': differ('/review', 'RM131.10 not counted yet', 'Nothing to review'),
  'transaction/[id].tsx': differ(
    `/transaction/${SALARY}`,
    '+RM4,200.00',
    "This spend isn't here any more",
  ),
  'transaction/new.tsx': same('/transaction/new', 'Add expense'),
  'wallet/[id].tsx': differ(
    `/wallet/${WALLET}`,
    'Balance not right?',
    "This wallet isn't here any more",
  ),
  'wallet/edit.tsx': differ(
    `/wallet/edit?id=${WALLET}`,
    'Save changes',
    "This wallet isn't here any more",
  ),
  'wallet/new.tsx': same('/wallet/new', 'Create wallet'),
  'wallets.tsx': differ(
    '/wallets',
    'Ringgit · main currency',
    'MYR wallets, closing balance each day',
  ),
};

/** Seeded store. Each row is a param a route reads, with a missing, unknown, or odd value. */
const PARAM_VISITS: [label: string, Visit][] = [
  ['bill, unknown series', { href: '/bill/unknown', text: "This bill isn't due this month" }],
  ['budget category, unknown id', { href: '/budget/unknown', text: 'This category is gone' }],
  ['budget category, nonsense month', { href: `/budget/${FOOD}?month=nonsense`, text: 'Food & Dining' }],
  ['debt, unknown id', { href: '/debt/unknown', text: "This debt isn't here any more" }],
  ['debt, someone owes me', { href: `/debt/${id('debt', 'aiman')}`, text: 'Aiman owes you' }],
  ['debt, settled', { href: `/debt/${id('debt', 'hana')}`, text: 'Hana' }],
  ['debt amount, no id', { href: '/debt/amount', text: "This debt isn't here any more" }],
  ['debt amount, unknown id', { href: '/debt/amount?id=unknown', text: "This debt isn't here any more" }],
  ['debt amount, borrow more', { href: `/debt/amount?id=${MEI}&mode=more`, text: 'Borrow more' }],
  ['debt amount, new debt', { href: '/debt/amount?mode=new', text: 'Done' }],
  ['place, unknown id', { href: '/place/unknown', text: 'Nothing here in this range' }],
  ['place, nonsense range', { href: `/place/${BANGSAR}?range=nonsense`, text: 'Bangsar' }],
  ['transaction, unknown id', { href: '/transaction/unknown', text: "This spend isn't here any more" }],
  ['transaction, a transfer', { href: `/transaction/${id('transaction', 'sample-12')}`, text: 'Cash withdrawal' }],
  ['transaction, from a bank alert', { href: `/transaction/${id('transaction', 'sample-3')}`, text: 'Starbucks' }],
  ['transaction, a debt mirror', { href: `/transaction/${id('transaction', 'debt-mei-principal')}`, text: 'Pay Mei RM40' }],
  ['new transaction, unknown ids', { href: '/transaction/new?walletId=unknown&categoryId=unknown&type=nonsense', text: 'Add expense' }],
  ['new transaction, income', { href: '/transaction/new?type=income', text: 'Add income' }],
  ['wallet, unknown id', { href: '/wallet/unknown', text: "This wallet isn't here any more" }],
  ['wallet, another currency', { href: `/wallet/${id('wallet', 'wise')}`, text: 'Wise USD' }],
  ['wallet, cash', { href: `/wallet/${id('wallet', 'cash')}`, text: 'Cash' }],
  ['wallet edit, no id', { href: '/wallet/edit', text: "This wallet isn't here any more" }],
  ['wallet edit, unknown id', { href: '/wallet/edit?id=unknown', text: "This wallet isn't here any more" }],
  ['category form, unknown id', { href: '/categories/form?id=unknown', text: 'Give it a name to save' }],
  ['category form, my category', { href: `/categories/form?id=${id('category', 'groceries')}`, text: 'Save changes' }],
  ['category form, income', { href: '/categories/form?type=income', text: 'Give it a name to save' }],
  ['review, unknown id', { href: '/review?id=unknown', text: 'RM131.10 not counted yet' }],
  ['chat, nonsense day', { href: '/chat?day=nonsense', text: 'Moni' }],
  ['chat, past day', { href: '/chat?day=2026-10-01', text: 'Moni' }],
  ['chat, draft', { href: '/chat?draft=lunch', text: 'Moni' }],
  ['activity, unknown category', { href: '/activity?categoryId=unknown', text: 'Activity' }],
  ['activity, unknown place', { href: '/activity?placeId=unknown', text: 'Activity' }],
  ['activity, nonsense day and month', { href: '/activity?day=nonsense&month=nonsense&range=nonsense', text: 'Activity' }],
];

/** Android throws when a string, or the 0 from `{count && <X />}`, sits outside a Text. */
function rawTextOutsideText(node: unknown, parent = 'root'): string[] {
  if (Array.isArray(node)) return node.flatMap((child) => rawTextOutsideText(child, parent));
  if (typeof node === 'string') return parent === 'Text' ? [] : [`"${node}" inside ${parent}`];
  if (!node || typeof node !== 'object') return [];
  const { type, children } = node as { type: string; children?: unknown };
  return rawTextOutsideText(children ?? [], type);
}

function textsOf(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsOf);
  return node && typeof node === 'object' ? textsOf((node as { children?: unknown }).children) : [];
}

let noise: string[] = [];

const { setImmediate: realSetImmediate } = jest.requireActual('timers');

/** Lets the network answer and timers fire, with each state update inside act. */
async function settle(): Promise<void> {
  for (let step = 0; step < 6; step += 1) {
    await act(async () => {
      await new Promise((resolve) => realSetImmediate(resolve));
    });
    act(() => {
      jest.advanceTimersByTime(250);
    });
  }
}

async function visit(
  { href, text }: Visit,
  {
    profile,
    theme,
    signedOut = false,
  }: { profile: Profile; theme: 'light' | 'dark'; signedOut?: boolean },
): Promise<void> {
  mockTheme = theme;
  serve(profile);
  const [key, session] = sessionStorageEntry();
  if (signedOut) await authMMKV.removeItem(key);
  else await authMMKV.setItem(key, session);
  jest.useFakeTimers({ now: new Date('2026-10-14T05:00:00.000Z') });
  renderRouter('./app', { initialUrl: href });
  await settle();
  expect(noise).toEqual([]);
  expect(rawTextOutsideText(screen.toJSON())).toEqual([]);
  if (screen.queryAllByText(text).length === 0) {
    throw new Error(`${href} shows no "${text}". It shows: ${textsOf(screen.toJSON()).join(' | ')}`);
  }
  cleanup();
}

beforeEach(async () => {
  noise = [];
  for (const level of ['error', 'warn'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      const line = args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' ');
      noise.push(`console.${level}: ${line.slice(0, 1200)}`);
    });
  }
  await clearStore();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const discovered = discoverRouteFiles();
const layouts = discovered.filter((file) => file.endsWith('_layout.tsx'));
const screens = discovered.filter((file) => !file.endsWith('_layout.tsx'));

it('has a row for every route file, and every layout is mounted through a screen under it', () => {
  expect([...screens].sort()).toEqual(Object.keys(ROUTES).sort());
  const orphans = layouts.filter((layout) => {
    const dir = layout.replace('_layout.tsx', '');
    return !screens.some((file) => file.startsWith(dir));
  });
  expect(orphans).toEqual([]);
});

it('flags a string or a stray 0 outside Text, and leaves Text alone', () => {
  const tree = {
    type: 'View',
    children: [
      { type: 'Text', children: ['fine'] },
      '0',
      { type: 'RCTScrollView', children: ['Hi'] },
    ],
  };
  expect(rawTextOutsideText(tree)).toEqual(['"0" inside View', '"Hi" inside RCTScrollView']);
});

describe.each(Object.entries(ROUTES))('%s', (_file, spec) => {
  const { signedOut } = spec;
  it('seeded: rows land under the mounted page in light, then opens from cache in dark', async () => {
    await visit(spec.seeded, { profile: 'full', theme: 'light', signedOut });
    await visit(spec.seeded, { profile: 'full', theme: 'dark', signedOut });
  });
  it('empty first run, in light and dark', async () => {
    await visit(spec.empty, { profile: 'empty', theme: 'light', signedOut });
    await visit(spec.empty, { profile: 'empty', theme: 'dark', signedOut });
  });
});

describe('params', () => {
  it.each(PARAM_VISITS)('%s', async (_label, target) => {
    await visit(target, { profile: 'full', theme: 'light' });
    await visit(target, { profile: 'full', theme: 'dark' });
  });
});
