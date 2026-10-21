import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecentList } from '@/components/home/recent-list';
import { openSheet } from '@/lib/sheet/sheet-store';
import { deleteTransaction } from '@/lib/supabase/transactions';
import { expense } from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'user_1' } }) }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/haptics', () => ({ holdCommit: jest.fn(), holdBloom: jest.fn() }));
jest.mock('@/lib/sheet/sheet-store', () => ({ openSheet: jest.fn(async () => true) }));
jest.mock('@/lib/supabase/profile', () => ({ ensureFinanceTimezone: async () => 'Asia/Kuala_Lumpur' }));
jest.mock('@/lib/supabase/transactions', () => ({
  deleteTransaction: jest.fn(async () => {}),
  updateTransaction: jest.fn(async () => {}),
}));

type Measure = (cb: (x: number, y: number, width: number, height: number) => void) => void;
const nativeMethods = jest.requireActual('@react-native/jest-preset/jest/MockNativeMethods')
  .default as { measureInWindow: jest.Mock<void, Parameters<Measure>> };

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};

describe('RecentList', () => {
  beforeEach(() => {
    nativeMethods.measureInWindow.mockImplementation((cb) => cb(20, 400, 350, 66));
  });

  it('opens the row menu on press and hold, and Delete asks before removing the row', async () => {
    const mamak = expense('t1', new Date(2026, 9, 13, 12).toISOString());
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <RecentList
          transactions={[mamak]}
          lookups={{ categoriesById: {}, walletNames: { maybank: 'Maybank' } }}
          onOpen={jest.fn()}
          onSeeAll={jest.fn()}
          onAdd={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    const row = screen.getByTestId('home.recent.row.t1');
    fireEvent(row, 'pressIn', { nativeEvent: { pageX: 100, pageY: 300 } });
    await act(async () => fireEvent(row, 'longPress'));

    await act(async () => fireEvent.press(screen.getByTestId('home.hold.delete')));

    expect(openSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'confirm',
        title: 'Delete this transaction?',
        confirmLabel: 'Delete',
      }),
    );
    expect(deleteTransaction).toHaveBeenCalledWith('t1');
  });
});
