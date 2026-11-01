import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import CaptureSourcesScreen from '@/app/capture-sources';
import { retryCaptures } from '@/lib/ai/background-processor';
import { enqueue, pruneCompleted, requeueGaveUp } from '@/lib/ai/processing-queue';
import { markCaptureStatus } from '@/lib/notifications/capture-status';

const MAYBANK = 'com.maybank2u.life';

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
jest.mock('@/lib/supabase/wallets', () => ({ updateWallet: jest.fn() }));
jest.mock('@/components/capture-sources/use-auto-add-rules', () => ({ useAutoAddRules: () => [] }));
jest.mock('@/components/capture-sources/use-capture-alert', () => ({ useCaptureAlert: () => null }));
jest.mock('@/components/capture-sources/keep-capture-running', () => ({
  KeepCaptureRunning: () => null,
}));
jest.mock('@/components/capture-sources/use-phone-access', () => ({
  accessSummary: () => 'All on',
  usePhoneAccess: () => ({
    access: { notifications: 'on', location: 'on', camera: 'on', microphone: 'on' },
    change: jest.fn(),
  }),
}));
jest.mock('@/components/capture-sources/use-linked-apps', () => ({
  useLinkedApps: () => ({
    wallets: [],
    apps: [
      {
        packageName: 'com.maybank2u.life',
        label: 'Maybank',
        wallets: [{ id: 'w1', name: 'Maybank' }],
        recordsLocation: false,
      },
    ],
  }),
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
});

describe('Capture sources after captures gave up', () => {
  it('stays quiet when nothing did', () => {
    render(<CaptureSourcesScreen />);
    expect(screen.queryByTestId('sources.unreached.retry')).toBeNull();
    expect(screen.getByText('No captures yet')).toBeTruthy();
  });

  it('counts them, per app and in total, including Say it and Scan, and offers Retry', () => {
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
    expect(screen.getByText("No captures yet · 2 couldn't reach Moni")).toBeTruthy();

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
