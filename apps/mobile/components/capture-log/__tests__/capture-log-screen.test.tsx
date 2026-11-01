import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

import CaptureLogScreen from '@/app/capture-log';
import { getOpenSheet } from '@/lib/sheet/sheet-store';
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
jest.mock('@/components/capture-sources/use-linked-apps', () => ({
  useLinkedApps: () => ({ wallets: [], apps: [] }),
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
