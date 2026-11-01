import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

import CaptureLogScreen from '@/app/capture-log';
import { retryCaptures } from '@/lib/ai/background-processor';
import { enqueue, getAll, pruneCompleted } from '@/lib/ai/processing-queue';
import { undoPairing } from '@/lib/proposals/pairing';
import { getOpenSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { dismissToast, undoToast, useToast } from '@/lib/toast/toast-store';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
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
let mockWallets: { id: string; notificationPackage: string | null }[] = [];
jest.mock('@/components/capture-sources/use-linked-apps', () => ({
  useLinkedApps: () => ({ wallets: mockWallets, apps: [] }),
}));
jest.mock('@/lib/proposals/pairing', () => ({ undoPairing: jest.fn(async () => true) }));
jest.mock('@/lib/ai/background-processor', () => ({ retryCaptures: jest.fn(async () => {}) }));
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

const storage = createMMKV({ id: 'moni-notifications' });
const KEY = 'captured_notifications';
const GRAB = "MAYBANK: You've spent RM23.40 at GRAB*FOOD.";

const storedIds = () =>
  (JSON.parse(storage.getString(KEY) ?? '[]') as { id: string }[]).map((entry) => entry.id);

function ToastText() {
  const toast = useToast();
  return toast ? <Text>{toast.text}</Text> : null;
}

function show() {
  render(
    <>
      <CaptureLogScreen />
      <ToastText />
    </>,
  );
}

beforeEach(() => {
  storage.set(
    KEY,
    JSON.stringify([
      {
        id: 'newest',
        receivedAt: '2026-10-14T04:50:00.000Z',
        app: 'Maybank',
        text: "MAYBANK: You've spent RM86.40 at JAYA GROCER.",
        status: 'waiting_for_review',
      },
      {
        id: 'middle',
        receivedAt: '2026-10-14T04:41:00.000Z',
        app: 'Maybank',
        text: GRAB,
        status: 'added',
        transactionId: 'tx-1',
      },
      {
        id: 'oldest',
        receivedAt: '2026-10-14T01:12:00.000Z',
        app: 'Shopee',
        text: 'Your parcel is out for delivery.',
        status: 'ignored',
      },
    ]),
  );
});

afterEach(() => {
  act(() => dismissToast());
});

describe('A capture that could not reach Moni', () => {
  const ALERT = "MAYBANK: You've spent RM12.00 at KEDAI ABC.";

  function logEntry(status: 'trying_again' | 'gave_up') {
    storage.set(
      KEY,
      JSON.stringify([
        {
          id: 'unread',
          receivedAt: '2026-10-14T04:50:00.000Z',
          app: 'Maybank',
          packageName: 'com.maybank2u.life',
          text: ALERT,
          status,
        },
      ]),
    );
  }

  function queued(status: 'pending' | 'gave_up') {
    enqueue({
      id: 'unread',
      type: 'notification',
      status,
      createdAt: '2026-10-14T04:50:00.000Z',
      notification: {
        id: 'unread',
        app: 'Maybank',
        packageName: 'com.maybank2u.life',
        title: 'Maybank',
        text: ALERT,
        time: '1',
        receivedAt: '2026-10-14T04:50:00.000Z',
      },
    });
  }

  beforeEach(() => {
    pruneCompleted();
    jest.mocked(retryCaptures).mockClear();
  });

  it('says so in its own words and offers Retry, never Ignored', () => {
    logEntry('gave_up');
    queued('gave_up');
    show();
    expect(screen.getAllByText("Couldn't reach Moni").length).toBeGreaterThan(0);
    expect(screen.getByText("Couldn't reach Moni 1")).toBeTruthy();
    expect(screen.queryByText('Ignored')).toBeNull();

    fireEvent.press(screen.getByTestId('capture-log.entry.unread.retry'));
    expect(retryCaptures).toHaveBeenCalledWith('unread');
  });

  it('shows Trying again while Moni is still trying, with Retry to try now', () => {
    logEntry('trying_again');
    queued('pending');
    show();
    expect(screen.getByText('Trying again 1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('capture-log.entry.unread.retry'));
    expect(retryCaptures).toHaveBeenCalledWith('unread');
  });

  it('offers no Retry once the queue no longer holds it', () => {
    logEntry('gave_up');
    show();
    expect(screen.queryByTestId('capture-log.entry.unread.retry')).toBeNull();
  });

  it('removes the kept copy with the alert, and Undo restores both', () => {
    logEntry('gave_up');
    queued('gave_up');
    show();
    fireEvent.press(screen.getByTestId('capture-log.entry.unread.dismiss'));
    expect(storedIds()).toEqual([]);
    expect(getAll()).toEqual([]);

    act(() => undoToast());
    expect(storedIds()).toEqual(['unread']);
    expect(getAll().map((item) => [item.id, item.status])).toEqual([['unread', 'gave_up']]);
  });
});

describe('Every status on one Capture log', () => {
  const PACKAGE = 'com.maybank2u.life';
  const CONTROLS = [
    ['waiting_for_review', 'review', 'Review it'],
    ['trying_again', 'retry', 'Retry'],
    ['gave_up', 'retry', 'Retry'],
    ['auto_added', 'transaction', 'See transaction'],
    ['added', 'transaction', 'See transaction'],
    ['same_payment', 'undo', 'Undo'],
    ['not_linked', 'link', 'Link Maybank to a wallet'],
    ['ignored', 'missed', 'This was a transaction'],
  ] as const;

  beforeEach(() => {
    mockWallets = [{ id: 'w1', notificationPackage: PACKAGE }];
    pruneCompleted();
    storage.set(
      KEY,
      JSON.stringify(
        CONTROLS.map(([status], index) => ({
          id: status,
          receivedAt: `2026-10-14T04:${String(50 - index)}:00.000Z`,
          app: 'Maybank',
          packageName: PACKAGE,
          text: `MAYBANK: You've spent RM${index + 1}.00 at KEDAI ABC.`,
          status,
          transactionId: status.endsWith('added') || status === 'same_payment' ? 'tx-1' : undefined,
        })),
      ),
    );
    for (const status of ['trying_again', 'gave_up'] as const) {
      enqueue({
        id: status,
        type: 'notification',
        status: status === 'gave_up' ? 'gave_up' : 'pending',
        createdAt: '2026-10-14T04:50:00.000Z',
        notification: {
          id: status,
          app: 'Maybank',
          packageName: PACKAGE,
          title: 'Maybank',
          text: 'text',
          time: '1',
          receivedAt: '2026-10-14T04:50:00.000Z',
        },
      });
    }
  });

  afterEach(() => {
    mockWallets = [];
    pruneCompleted();
  });

  it.each(CONTROLS)('%s offers its own control', (status, control, label) => {
    show();
    const button = screen.getByTestId(tid('capture-log', 'entry', status, control));
    expect(button.props.accessibilityLabel).toMatch(new RegExp(`^${label}, Maybank `));
  });

  it('same_payment keeps its way to the row counting it beside Undo', async () => {
    show();
    expect(screen.getByTestId('capture-log.entry.same-payment.transaction')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('capture-log.entry.same-payment.undo'));
    });
    expect(undoPairing).toHaveBeenCalledWith('same_payment');
  });

  it.each(CONTROLS)('%s can be dismissed, and Undo brings it back', (status) => {
    show();
    fireEvent.press(screen.getByTestId(tid('capture-log', 'entry', status, 'dismiss')));
    expect(storedIds()).toHaveLength(CONTROLS.length - 1);
    expect(storedIds()).not.toContain(status);

    act(() => undoToast());
    expect(storedIds()).toHaveLength(CONTROLS.length);
    expect(storedIds()).toContain(status);
  });
});

describe('Capture log clearing', () => {
  it('removes one alert from the phone and Undo puts it back in its place', () => {
    show();
    fireEvent.press(screen.getByTestId('capture-log.entry.middle.dismiss'));
    expect(storedIds()).toEqual(['newest', 'oldest']);
    expect(screen.queryByText(GRAB)).toBeNull();
    expect(screen.getByText('Alert removed')).toBeTruthy();

    act(() => undoToast());
    expect(storedIds()).toEqual(['newest', 'middle', 'oldest']);
    expect(screen.getByText(GRAB)).toBeTruthy();
  });

  it('falls back to All when the last alert of the picked status goes', () => {
    show();
    fireEvent.press(screen.getByTestId('capture-log.filter.ignored'));
    expect(screen.queryByText(GRAB)).toBeNull();

    fireEvent.press(screen.getByTestId('capture-log.entry.oldest.dismiss'));
    expect(screen.queryByTestId('capture-log.filter.ignored')).toBeNull();
    expect(screen.getByText(GRAB)).toBeTruthy();
  });

  it('asks before Clear all and says transactions and captures stay', async () => {
    show();
    fireEvent.press(screen.getByTestId('capture-log.clear-all'));
    const sheet = getOpenSheet();
    if (sheet?.kind !== 'confirm') throw new Error('Clear all opens the confirm sheet');
    expect(sheet.request.message).toBe(
      'This removes the alert text kept on this phone. Transactions and captures waiting for review stay as they are.',
    );
    expect(storedIds()).toEqual(['newest', 'middle', 'oldest']);

    await act(async () => sheet.settle(true));
    expect(storage.getString(KEY)).toBeUndefined();
    expect(screen.getByText('Nothing captured yet')).toBeTruthy();
    expect(screen.getByText('Capture log cleared')).toBeTruthy();
    expect(screen.queryByTestId('capture-log.clear-all')).toBeNull();
  });

  it('keeps every alert when Clear all is cancelled', async () => {
    show();
    fireEvent.press(screen.getByTestId('capture-log.clear-all'));
    await act(async () => getOpenSheet()?.settle(null));
    expect(storedIds()).toEqual(['newest', 'middle', 'oldest']);
    expect(screen.getByText('Your parcel is out for delivery.')).toBeTruthy();
  });
});
