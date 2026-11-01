import { act, fireEvent, render, screen } from '@testing-library/react-native';

import CaptureLogScreen from '@/app/capture-log';
import { undoPairing } from '@/lib/proposals/pairing';
import { dismissToast, useToast } from '@/lib/toast/toast-store';

const mockRefresh = jest.fn();
const mockPush = jest.fn();
const mockEntries = [
  {
    id: 'tng',
    receivedAt: new Date(2026, 9, 14, 12, 44).toISOString(),
    app: "Touch 'n Go",
    packageName: 'my.com.tngdigital.ewallet',
    text: 'Payment of RM15.90 to GUARDIAN was successful.',
    status: 'same_payment',
    transactionId: 't1',
  },
  {
    id: 'bank',
    receivedAt: new Date(2026, 9, 14, 12, 41).toISOString(),
    app: 'Maybank',
    packageName: 'com.maybank2u.life',
    text: "MAYBANK: You've spent RM15.90 at TNG DIGITAL on 14/10 12:41.",
    status: 'auto_added',
    transactionId: 't1',
  },
];

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
  useFocusEffect: () => {},
}));
jest.mock('@/lib/ai/background-processor', () => ({ retryCaptures: jest.fn(async () => {}) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('@/hooks/use-notification-listener', () => ({
  useNotificationListener: () => ({ notifications: mockEntries, refresh: mockRefresh }),
}));
jest.mock('@/components/capture-sources/use-linked-apps', () => ({
  useLinkedApps: () => ({ wallets: [], apps: [] }),
}));
jest.mock('@/components/capture-log/link-app', () => ({ linkAppToWallet: jest.fn() }));
jest.mock('@/lib/notifications/app-icon-cache', () => ({ getCachedAppIcon: () => null }));
jest.mock('@/lib/proposals/pairing', () => ({ undoPairing: jest.fn(async () => true) }));

function ToastText() {
  const toast = useToast();
  return toast ? <ToastLabel text={toast.text} /> : null;
}
function ToastLabel({ text }: { text: string }) {
  const { Text } = jest.requireActual('react-native');
  return <Text>{text}</Text>;
}

afterEach(() => {
  act(() => dismissToast());
  jest.clearAllMocks();
});

describe('Capture log, an alert counted with another', () => {
  it('keeps the alert in the log with its quote, the other alert, and the row that counts it', () => {
    render(<CaptureLogScreen />);

    expect(screen.getByText('Payment of RM15.90 to GUARDIAN was successful.')).toBeTruthy();
    expect(screen.getAllByText('Same payment').length).toBeGreaterThan(0);
    expect(screen.getByText('Counted once, with the Maybank alert at 12:41 pm.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('capture-log.entry.tng.transaction'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction/[id]',
      params: { id: 't1' },
    });
  });

  it('Undo makes it its own capture and refreshes the log', async () => {
    render(
      <>
        <CaptureLogScreen />
        <ToastText />
      </>,
    );

    await act(async () => fireEvent.press(screen.getByTestId('capture-log.entry.tng.undo')));

    expect(undoPairing).toHaveBeenCalledWith('tng');
    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.getByText('Back in Review as its own capture')).toBeTruthy();
  });

  it('offers Undo only on the folded alert', () => {
    render(<CaptureLogScreen />);
    expect(screen.queryByTestId('capture-log.entry.bank.undo')).toBeNull();
  });
});
