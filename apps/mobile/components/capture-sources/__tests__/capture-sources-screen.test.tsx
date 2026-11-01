import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import CaptureSourcesScreen from '@/app/capture-sources';
import { retryCaptures } from '@/lib/ai/background-processor';
import { enqueue, pruneCompleted, requeueGaveUp } from '@/lib/ai/processing-queue';
import { markCaptureStatus } from '@/lib/notifications/capture-status';
import { NOTIFICATION_ACCESS_DISCLOSURE } from '@/lib/notifications/permission';

const MAYBANK = 'com.maybank2u.life';
const MAYBANK_APP = {
  packageName: MAYBANK,
  label: 'Maybank',
  wallets: [{ id: 'w1', name: 'Maybank Savings' }],
  recordsLocation: false,
};

let mockApps: (typeof MAYBANK_APP)[] = [MAYBANK_APP];
let mockNotifications: 'on' | 'off' = 'on';
let mockAlert: { alert: { kind: string }; title: string; body: string; actionLabel: string; fix: () => void } | null =
  null;

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), back: jest.fn(), push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(effect, [effect]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  return {
    createMMKV: ({ id }: { id: string }) => {
      const store = stores.get(id) ?? new Map<string, string>();
      stores.set(id, store);
      return {
        set: (key: string, value: string) => store.set(key, value),
        getString: (key: string) => store.get(key),
        remove: (key: string) => store.delete(key),
      };
    },
  };
});
jest.mock('@/lib/ai/background-processor', () => ({ retryCaptures: jest.fn(async () => {}) }));
jest.mock('@/lib/supabase/auto-add-rules', () => ({
  createAutoAddRule: jest.fn(),
  deleteAutoAddRule: jest.fn(),
}));
jest.mock('@/components/capture-sources/use-auto-add-rules', () => ({ useAutoAddRules: () => [] }));
jest.mock('@/components/capture-sources/use-capture-alert', () => ({
  useCaptureAlert: () => mockAlert,
}));
jest.mock('@/components/capture-sources/keep-capture-running', () => ({
  KeepCaptureRunning: () => null,
}));
jest.mock('@/components/capture-sources/use-phone-access', () => ({
  usePhoneAccess: () => ({
    access: { notifications: mockNotifications, location: 'on', camera: 'on', microphone: 'on' },
    change: jest.fn(),
  }),
}));
jest.mock('@/components/capture-sources/use-linked-apps', () => ({
  useLinkedApps: () => ({ wallets: [], apps: mockApps }),
}));

function gaveUp(id: string, packageName: string) {
  enqueue({
    id,
    type: 'notification',
    status: 'gave_up',
    createdAt: '2026-10-20T04:50:00.000Z',
    notification: {
      id,
      app: packageName,
      packageName,
      title: 'Bank',
      text: 'spent RM1.00',
      time: '1',
      receivedAt: '2026-10-20T04:50:00.000Z',
    },
  });
}

beforeEach(() => {
  Platform.OS = 'android';
  pruneCompleted();
  jest.mocked(retryCaptures).mockClear();
  jest.mocked(router.push).mockClear();
  mockApps = [MAYBANK_APP];
  mockNotifications = 'on';
  mockAlert = null;
});

const NOTE_START = 'Moni saves a place only when a payment arrives, and never tracks where you go.';

describe('Capture sources', () => {
  it('aggregates notifications into one row with no app named anywhere', () => {
    render(<CaptureSourcesScreen />);

    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Reads alerts from the apps you link on your wallets')).toBeTruthy();
    expect(screen.queryByText('Bank notifications')).toBeNull();
    expect(screen.queryByText(/Maybank/)).toBeNull();
    expect(screen.queryByText('Linked apps')).toBeNull();
    expect(screen.queryByText(/Moni works without/)).toBeNull();
    expect(screen.getByTestId('sources.location')).toBeTruthy();
    expect(screen.queryByTestId('sources.location.maybank')).toBeNull();
  });

  it('keeps the disclosure next to the shield note while access is on', () => {
    render(<CaptureSourcesScreen />);
    expect(screen.getByText(`${NOTE_START} ${NOTIFICATION_ACCESS_DISCLOSURE}`)).toBeTruthy();
  });

  it('shows the disclosure once, on the denied card, when access is off', () => {
    mockNotifications = 'off';
    render(<CaptureSourcesScreen />);

    expect(screen.getByText("Moni can't see notifications")).toBeTruthy();
    expect(screen.queryByText(/Maybank/)).toBeNull();
    expect(screen.getByText(NOTIFICATION_ACCESS_DISCLOSURE)).toBeTruthy();
    expect(screen.getByText(NOTE_START)).toBeTruthy();
    expect(screen.queryByTestId('sources.notifications')).toBeNull();
  });

  it('sends a person with no linked app to the wallet pages', () => {
    mockApps = [];
    render(<CaptureSourcesScreen />);

    fireEvent.press(screen.getByTestId('sources.link-app'));
    expect(router.push).toHaveBeenCalledWith('/wallets');
  });

  it('has no link row once an app is linked', () => {
    render(<CaptureSourcesScreen />);
    expect(screen.queryByTestId('sources.link-app')).toBeNull();
  });

  it('keeps the Gone quiet banner and its fix', () => {
    const fix = jest.fn();
    mockAlert = {
      alert: { kind: 'app_quiet' },
      title: 'Maybank has gone quiet',
      body: 'Nothing for 5 days. Add anything Moni missed.',
      actionLabel: 'Add it',
      fix,
    };
    render(<CaptureSourcesScreen />);

    expect(screen.getByText('Maybank has gone quiet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sources.capture-alert.fix'));
    expect(fix).toHaveBeenCalledTimes(1);
  });
});

describe('Capture sources after captures gave up', () => {
  it('stays quiet when nothing did', () => {
    render(<CaptureSourcesScreen />);
    expect(screen.queryByTestId('sources.unreached.retry')).toBeNull();
  });

  it('counts them in total, including Say it and Scan, and offers Retry', () => {
    gaveUp('a', MAYBANK);
    gaveUp('b', MAYBANK);
    gaveUp('c', 'com.grab.passenger');
    enqueue({
      id: 'said',
      type: 'text',
      text: 'lunch 12',
      status: 'gave_up',
      createdAt: '2026-10-20T04:50:00.000Z',
    });
    render(<CaptureSourcesScreen />);

    expect(screen.getByText("4 captures couldn't reach Moni.")).toBeTruthy();

    fireEvent.press(screen.getByTestId('sources.unreached.retry'));
    expect(retryCaptures).toHaveBeenCalledWith();
  });

  it('drops the count when a retry goes back in the queue', () => {
    gaveUp('a', MAYBANK);
    render(<CaptureSourcesScreen />);
    expect(screen.getByText("1 capture couldn't reach Moni.")).toBeTruthy();

    act(() => {
      requeueGaveUp('a');
      markCaptureStatus('a', 'trying_again');
    });
    expect(screen.queryByTestId('sources.unreached.retry')).toBeNull();
  });
});
