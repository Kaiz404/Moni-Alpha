import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { reportMissedFrom } from '@/components/capture-log/report-missed';
import { askForNotificationAccess, readNotificationListenerPermission } from '@/lib/notifications/permission';
import { openSheet } from '@/lib/sheet/sheet-store';
import { updateWallet } from '@/lib/supabase/wallets';
import { financeWallet } from '@/lib/wallets/__tests__/balance-fixture';
import { useWalletNamesLinkedTo, type WalletAlertLink } from '@/lib/wallets/wallet-link';
import { WalletAlerts } from '../wallet-sections';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), dismissTo: jest.fn() },
  useFocusEffect: () => {},
}));
jest.mock('@/lib/ai/processing-queue', () => ({ listGaveUp: () => [] }));
jest.mock('@/lib/notifications/capture-status', () => ({ onCaptureStatusChanged: () => () => {} }));
jest.mock('@/lib/notifications/permission', () => ({
  askForNotificationAccess: jest.fn(async () => {}),
  readNotificationListenerPermission: jest.fn(async () => 'authorized'),
}));
jest.mock('@/lib/sheet/sheet-store', () => ({ openSheet: jest.fn() }));
jest.mock('@/lib/supabase/wallets', () => ({ updateWallet: jest.fn(async () => ({})) }));
jest.mock('@/components/capture-log/report-missed', () => ({ reportMissedFrom: jest.fn() }));
jest.mock('@/components/capture-sources/use-linked-apps', () => ({
  useLinkedApps: () => ({
    wallets: [
      { id: 'w1', notificationPackage: 'com.example.anybank' },
      { id: 'w2', notificationPackage: 'com.example.anybank' },
    ],
    apps: [],
  }),
}));
jest.mock('@/lib/wallets/wallet-link', () => ({ useWalletNamesLinkedTo: jest.fn(() => []) }));

const LINKED: WalletAlertLink = {
  notificationPackage: 'com.example.anybank',
  notificationAppLabel: 'Any Bank',
  notificationAccountHint: null,
};
const UNLINKED: WalletAlertLink = {
  notificationPackage: null,
  notificationAppLabel: null,
  notificationAccountHint: null,
};
const cash = financeWallet({ id: 'w1', name: 'Rainy day', type: 'cash', recordLocation: true });

async function show(link: WalletAlertLink, wallet = cash) {
  render(
    <WalletAlerts
      wallet={wallet}
      link={link}
    />,
  );
  await act(async () => {});
}

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
});

beforeEach(() => {
  jest.mocked(updateWallet).mockClear();
  jest.mocked(openSheet).mockReset();
  jest.mocked(askForNotificationAccess).mockClear();
  jest.mocked(readNotificationListenerPermission).mockResolvedValue('authorized');
  jest.mocked(useWalletNamesLinkedTo).mockReturnValue([]);
});

describe('WalletAlerts', () => {
  it('offers linking on a cash wallet and saves the app it picks', async () => {
    jest.mocked(openSheet).mockResolvedValueOnce({
      app: { packageName: 'com.example.anybank', label: 'Any Bank' },
    } as never);
    await show(UNLINKED);

    expect(screen.getByText('Link an app')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('wallet.alerts')));

    expect(openSheet).toHaveBeenCalledWith({
      kind: 'notificationApp',
      selected: null,
      selectedLabel: null,
    });
    expect(updateWallet).toHaveBeenCalledWith('w1', {
      notificationPackage: 'com.example.anybank',
      notificationAppLabel: 'Any Bank',
      notificationAccountHint: null,
    });
  });

  it('asks for notification access first, and opens no sheet', async () => {
    jest.mocked(readNotificationListenerPermission).mockResolvedValue('denied');
    await show(UNLINKED);

    await act(async () => fireEvent.press(screen.getByTestId('wallet.alerts')));

    expect(askForNotificationAccess).toHaveBeenCalledTimes(1);
    expect(openSheet).not.toHaveBeenCalled();
  });

  it('shows the linked app with its health, and clears the link on Don\'t link', async () => {
    jest.mocked(openSheet).mockResolvedValueOnce({ app: null } as never);
    await show({ ...LINKED, notificationAccountHint: 'Savings' });

    expect(screen.getByText('Any Bank')).toBeTruthy();
    expect(screen.getByText('No captures yet')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('wallet.alerts')));

    expect(updateWallet).toHaveBeenCalledWith('w1', {
      notificationPackage: null,
      notificationAppLabel: null,
      notificationAccountHint: null,
    });
  });

  it('reports a missed transaction against this wallet, not the first on the app', async () => {
    await show(LINKED, financeWallet({ id: 'w2', type: 'bank' }));

    fireEvent.press(screen.getByTestId('wallet.alerts.report-missed'));

    expect(reportMissedFrom).toHaveBeenCalledWith('com.example.anybank', [
      { id: 'w2', notificationPackage: 'com.example.anybank' },
    ]);
  });

  it('turns location off for this wallet alone', async () => {
    await show(LINKED);

    fireEvent.press(screen.getByTestId('wallet.location'));

    expect(updateWallet).toHaveBeenCalledWith('w1', { recordLocation: false });
  });

  it('hides location and the hint while nothing is linked', async () => {
    await show(UNLINKED);

    expect(screen.queryByTestId('wallet.location')).toBeNull();
    expect(screen.queryByTestId('wallet.account-hint')).toBeNull();
  });

  it('asks for an account hint only when another wallet reads the app, and saves it on leaving', async () => {
    await show(LINKED);
    expect(screen.queryByTestId('wallet.account-hint')).toBeNull();
    screen.unmount();

    jest.mocked(useWalletNamesLinkedTo).mockReturnValue(['Salary']);
    await show(LINKED);

    const field = screen.getByTestId('wallet.account-hint');
    expect(screen.getByText(/Any Bank also sends alerts for Salary/)).toBeTruthy();
    fireEvent.changeText(field, ' ****4521 ');
    fireEvent(field, 'blur');

    expect(updateWallet).toHaveBeenCalledWith('w1', { notificationAccountHint: '****4521' });
  });
});
