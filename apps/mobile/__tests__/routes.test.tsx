import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import {
  fakeFetch,
  id,
  serve,
  sessionStorageEntry,
  setOnline,
  SilentWebSocket,
  systemCategoryId,
  type Profile,
} from './support/fake-backend';

// Before the imports below: supabase-js picks up fetch when the app's client module loads.
global.fetch = fakeFetch as typeof fetch;
(global as unknown as { WebSocket: unknown }).WebSocket = SilentWebSocket;

/* eslint-disable import/first */
import { act, cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { MinorAmount } from '@repo/types';
import { router } from 'expo-router';
import { Share } from 'react-native';

import { authMMKV } from '@/lib/mmkv/auth';
import { dismissSheet } from '@/lib/sheet/sheet-store';
import { clearStore } from '@/lib/store';
import { createTransaction, updateTransaction } from '@/lib/supabase/transactions';
import { dismissToast } from '@/lib/toast/toast-store';
/* eslint-enable import/first */

let mockTheme: 'light' | 'dark' = 'light';
let mockOnline = true;

// expo-router's testing library swaps in Reanimated's bare mock, which lacks these.
Object.assign(jest.requireMock('react-native-reanimated'), {
  useReducedMotion: () => false,
  LayoutAnimationConfig: ({ children }: { children: unknown }) => children,
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
  default: { getInstalledAppsAsync: async () => [] },
  isMoniAndroidAppsNativeAvailable: () => true,
}));
// Its native module loads through import(), which Jest cannot run without ESM mode.
jest.mock('@/lib/notifications/permission', () => ({
  NOTIFICATION_ACCESS_DISCLOSURE: 'One-time codes never leave this phone.',
  readNotificationListenerPermission: async () => 'authorized',
  openNotificationListenerSettings: () => {},
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
  useNetworkState: () => ({
    isConnected: mockOnline,
    isInternetReachable: mockOnline,
    type: mockOnline ? 'WIFI' : 'NONE',
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
  'import/index.tsx': same('/import', 'Choose a CSV'),
  'import/columns.tsx': same('/import/columns', 'No file chosen'),
  'import/preview.tsx': same('/import/preview', 'No file chosen'),
  'bill/[seriesKey].tsx': differ(
    `/bill/${NETFLIX}`,
    'Stop tracking Netflix',
    "This bill isn't due this month",
  ),
  'bill/new.tsx': same('/bill/new', 'How much is it each time?'),
  'budget/[categoryId].tsx': differ(`/budget/${FOOD}`, 'of RM450', 'No budget for Food & Dining'),
  'budget/edit.tsx': same('/budget/edit', 'Monthly total'),
  'budget/list.tsx': same('/budget/list', 'Monthly total'),
  'budget/spending.tsx': differ(
    `/budget/spending?month=2026-10&categoryId=${FOOD}`,
    'October · 13 payments',
    'No payments left here',
  ),
  'capture-log.tsx': same('/capture-log', 'Nothing captured yet'),
  'capture-sources.tsx': differ(
    '/capture-sources',
    'Keep capture running',
    'On a wallet page',
  ),
  'capture/say.tsx': same('/capture/say', 'Say the shop, the amount and how you paid.'),
  'capture/scan.tsx': same('/capture/scan', 'Scan a receipt'),
  'categories/form.tsx': same('/categories/form', 'Give it a name to save'),
  'categories/index.tsx': differ(
    '/categories',
    'Custom · RM235.30 since 1 Oct',
    "Make one for anything the presets don't fit",
  ),
  'chat.tsx': same('/chat', "Hi Kai. Tell me what you spent and I'll file it."),
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
    'Net worth',
  ),
};

/** Seeded store. Each row is a param a route reads, with a missing, unknown, or odd value. */
const PARAM_VISITS: [label: string, Visit][] = [
  ['home, greets by the name sign-up saved', { href: '/', text: 'Afternoon, Kai' }],
  ['bill, unknown series', { href: '/bill/unknown', text: "This bill isn't due this month" }],
  ['budget category, unknown id', { href: '/budget/unknown', text: 'This category is gone' }],
  ['budget category, nonsense month', { href: `/budget/${FOOD}?month=nonsense`, text: 'Spent in October' }],
  ['budget category, month 13', { href: `/budget/${FOOD}?month=2026-13`, text: 'Spent in October' }],
  ['spending, no scope', { href: '/budget/spending', text: 'These payments are gone' }],
  ['spending, nonsense day', { href: '/budget/spending?day=2026-13-40', text: 'These payments are gone' }],
  ['spending, nonsense month', { href: `/budget/spending?month=nonsense&categoryId=${FOOD}`, text: 'October · 13 payments' }],
  ['spending, unknown category', { href: '/budget/spending?month=2026-10&categoryId=unknown', text: 'No category' }],
  ['spending, no category', { href: '/budget/spending?month=2026-10&categoryId=none', text: 'No category' }],
  ['spending, a name with & in it', { href: '/budget/spending?month=2026-10&merchant=A%26W', text: 'A&W' }],
  ['spending, a day', { href: '/budget/spending?day=2026-10-13', text: 'Tue 13 Oct' }],
  ['debt, unknown id', { href: '/debt/unknown', text: "This debt isn't here any more" }],
  ['debt, someone owes me', { href: `/debt/${id('debt', 'aiman')}`, text: 'Aiman owes you' }],
  ['debt, settled', { href: `/debt/${id('debt', 'hana')}`, text: 'Hana' }],
  ['debt amount, no id', { href: '/debt/amount', text: "This debt isn't here any more" }],
  ['debt amount, unknown id', { href: '/debt/amount?id=unknown', text: "This debt isn't here any more" }],
  ['debt amount, borrow more', { href: `/debt/amount?id=${MEI}&mode=more`, text: 'Borrow more' }],
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

/** A NaN reaching a layout or SVG prop can kill the Android view; on screen it reads RMNaN. */
function brokenValues(node: unknown): string[] {
  if (typeof node === 'string') {
    return /\bNaN\b|\bundefined\b|\[object Object\]/.test(node) ? [`text "${node}"`] : [];
  }
  if (Array.isArray(node)) return node.flatMap(brokenValues);
  if (!node || typeof node !== 'object') return [];
  const { type, props = {}, children } = node as {
    type: string;
    props?: Record<string, unknown>;
    children?: unknown;
  };
  const inValue = (name: string, value: unknown): string[] => {
    if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${type}.${name}=${value}`];
    return typeof value === 'string' && /\bNaN\b/.test(value) ? [`${type}.${name}="${value}"`] : [];
  };
  const inStyle = (name: string, style: unknown): string[] =>
    style && typeof style === 'object'
      ? Object.entries(style).flatMap(([key, value]) => inStyle(`${name}.${key}`, value))
      : inValue(name, style);
  return [
    ...Object.entries(props).flatMap(([name, value]) =>
      name === 'style' ? inStyle(name, value) : inValue(name, value),
    ),
    ...brokenValues(children ?? []),
  ];
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

type Mount = { profile: Profile; theme: 'light' | 'dark'; signedOut?: boolean };

async function mount(href: string, { profile, theme, signedOut = false }: Mount): Promise<void> {
  mockTheme = theme;
  serve(profile);
  const [key, session] = sessionStorageEntry();
  if (signedOut) await authMMKV.removeItem(key);
  else await authMMKV.setItem(key, session);
  jest.useFakeTimers({ now: new Date('2026-10-14T05:00:00.000Z') });
  renderRouter('./app', { initialUrl: href });
  await settle();
}

async function visit({ href, text }: Visit, options: Mount): Promise<void> {
  await mount(href, options);
  expect(noise).toEqual([]);
  expect(rawTextOutsideText(screen.toJSON())).toEqual([]);
  expect(brokenValues(screen.toJSON())).toEqual([]);
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

// The first mount loads the whole app, and one timeout fails every route after it.
jest.setTimeout(30_000);

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

describe('offline', () => {
  afterEach(() => {
    setOnline(true);
    mockOnline = true;
  });
  it.each(Object.entries(ROUTES).filter(([, spec]) => !spec.signedOut))('%s opens from cache', async (_file, spec) => {
    await visit(spec.seeded, { profile: 'full', theme: 'light' });
    setOnline(false);
    mockOnline = false;
    await visit(spec.seeded, { profile: 'full', theme: 'light' });
  });
});

describe('params', () => {
  it.each(PARAM_VISITS)('%s', async (_label, target) => {
    await visit(target, { profile: 'full', theme: 'light' });
    await visit(target, { profile: 'full', theme: 'dark' });
  });
});

describe('a Budget row opens its payments under Budget', () => {
  const open = async (testID: string) => {
    fireEvent.press(screen.getByTestId(testID));
    await settle();
  };
  const leave = async () => {
    act(() => router.back());
    await settle();
  };
  const text = (testID: string) => textsOf(screen.getByTestId(testID).children);

  it('a By category row lists what adds up to its amount, then back keeps the month', async () => {
    await mount('/budget', { profile: 'full', theme: 'light' });
    await open('budget.month');
    await open('sheet.option.2026-09');
    expect(text('budget.month')).toEqual(['September']);
    expect(screen.getByTestId('budget.merchant.netflix').props.accessibilityLabel).toBe(
      'Netflix, 1 payment · Maybank, RM54.90',
    );
    const row = screen.getAllByTestId(/^budget\.by-category\./)[0];
    const [, , amount] = row.props.accessibilityLabel.split(', ');
    await open(row.props.testID);
    expect(row.props.accessibilityLabel).toContain('Same as Aug');
    expect(text('budget.spending.total')).toEqual([amount]);
    expect(text('budget.spending.meta')[0]).toMatch(/^September · \d+ payments?$/);
    expect(text('budget.spending.change')).toEqual(['Same as Aug']);
    expect(screen.queryByTestId('budget.back')).not.toBeNull();
    expect(screen.queryByTestId('activity.search')).toBeNull();
    await leave();
    expect(text('budget.month')).toEqual(['September']);
    expect(noise).toEqual([]);
  });

  it('shows an edit from the transaction page on this page and on the tab', async () => {
    await mount('/budget', { profile: 'full', theme: 'light' });
    const rowId = `budget.by-category.${FOOD}`;
    await open(rowId);
    expect(text('budget.spending.total')).toEqual(['RM349.80']);
    await open(`budget.transaction.${id('transaction', 'sample-34')}`);
    // Both pages behind the transaction are frozen by the root Stack, so this is the case that could go stale.
    expect(screen.queryByTestId('budget.spending.total')).toBeNull();
    expect(screen.queryByTestId(rowId)).toBeNull();
    await act(() => updateTransaction(id('transaction', 'sample-34'), { amountMinor: 2320 as MinorAmount }));
    await leave();
    expect(text('budget.spending.total')).toEqual(['RM359.80']);
    await leave();
    expect(screen.getByTestId(rowId).props.accessibilityLabel).toContain('RM359.80');
    expect(noise).toEqual([]);
  });

  it('a merchant on a category page counts only that category', async () => {
    await mount(`/budget/${FOOD}`, { profile: 'full', theme: 'light' });
    const row = screen.getAllByTestId(/^budget\.merchant\.(?!.*\.)/)[0];
    const parts = row.props.accessibilityLabel.split(', ');
    await open(row.props.testID);
    expect(text('budget.spending.total')).toEqual([parts[parts.length - 1]]);
    expect(text('budget.spending.meta')[0]).toMatch(/^October · Food & Dining · \d+ payments?$/);
  });

  it("a category page's See all stays under Budget", async () => {
    await mount(`/budget/${FOOD}`, { profile: 'full', theme: 'light' });
    await open('budget.category.see-all');
    expect(text('budget.spending.meta')).toEqual(['October · 13 payments']);
  });

  it("a Calendar day's All link lists that day", async () => {
    await mount('/budget', { profile: 'full', theme: 'light' });
    await open('budget.view.calendar');
    await open('budget.calendar.day.10');
    await open('budget.day.all');
    expect(text('budget.spending.meta')).toEqual(['4 payments']);
    expect(screen.getAllByText('Sat 10 Oct').length).toBeGreaterThan(0);
  });

  it('turns pages when a list runs past one page', async () => {
    await mount(`/budget/spending?month=2026-10&categoryId=${FOOD}`, { profile: 'full', theme: 'light' });
    expect(screen.queryByTestId('budget.pager.page')).toBeNull();
    await act(async () => {
      for (const day of [1, 2, 3, 4, 5, 6, 7, 8]) {
        await createTransaction(
          {
            walletId: id('wallet', 'cash'),
            amountMinor: 100 as MinorAmount,
            type: 'expense',
            categoryId: FOOD,
            description: `Lunch ${day}`,
            transactionDate: new Date(2026, 9, day, 12).toISOString(),
          },
          'manual',
          { id: id('transaction', `lunch-${day}`) },
        );
      }
    });
    await settle();
    expect(text('budget.pager.page')).toEqual(['Page 1 of 2']);
    expect(text('budget.spending.meta')).toEqual(['October · 21 payments']);
    await open('budget.pager.older');
    expect(text('budget.pager.page')).toEqual(['Page 2 of 2']);
    expect(text('budget.spending.total')).toEqual(['RM357.80']);
  });

  it('the tab leads with the ring and budgets, with no way into a Reports page', async () => {
    await mount('/budget', { profile: 'full', theme: 'light' });
    const order = textsOf(screen.toJSON());
    const places = ['Budgets', 'Bills', 'By category', 'Top merchants'].map((title) =>
      order.findIndex((line) => line.startsWith(title)),
    );
    expect(places).toEqual([...places].sort((a, b) => a - b));
    expect(places.every((place) => place >= 0)).toBe(true);
    expect(screen.queryByTestId('budget.reports')).toBeNull();
  });
});

const pressableIds = (): string[] => [
  ...new Set(
    screen
      .queryAllByTestId(/./)
      .filter((node) => node.props.onClick != null || node.props.onStartShouldSetResponder != null)
      .map((node) => node.props.testID as string),
  ),
];

/**
 * Presses every control a route shows, then every control that press revealed (a sheet's
 * options, a confirm), each from a fresh mount. Too slow for the default run:
 * `pnpm --filter moni test:taps`.
 */
(process.env.TAP_EVERY_CONTROL === '1' ? describe : describe.skip)('every control', () => {
  const MAX_DEPTH = 2;
  const pressed = new Set<string>();
  const cases = Object.entries(ROUTES).flatMap(([file, spec]) => [
    [`${file} seeded`, spec.seeded.href, 'full', spec.signedOut],
    [`${file} empty`, spec.empty.href, 'empty', spec.signedOut],
  ]) as [string, string, Profile, true | undefined][];

  afterAll(() => {
    process.stdout.write(`Pressed ${pressed.size} controls\n`);
  });

  it.each(cases)('%s', async (_label, href, profile, signedOut) => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
    const options: Mount = { profile, theme: 'light', signedOut };
    const failures: string[] = [];
    const queue: string[][] = [[]];
    while (queue.length > 0) {
      const path = queue.shift() as string[];
      dismissSheet();
      dismissToast();
      await clearStore();
      await mount(href, options);
      try {
        for (const testID of path) {
          fireEvent.press(screen.getAllByTestId(testID)[0]);
          await settle();
        }
        const raw = [...rawTextOutsideText(screen.toJSON()), ...brokenValues(screen.toJSON())];
        if (noise.length > 0 || raw.length > 0) {
          failures.push(`${path.join(' > ')}: ${[...noise, ...raw].join(' || ')}`);
        }
        if (path.length < MAX_DEPTH) {
          for (const testID of pressableIds()) {
            if (pressed.has(testID)) continue;
            pressed.add(testID);
            queue.push([...path, testID]);
          }
        }
      } catch (error) {
        failures.push(`${path.join(' > ')}: ${(error as Error).stack}`);
      }
      noise = [];
      cleanup();
    }
    expect(failures).toEqual([]);
  }, 590_000);
});
