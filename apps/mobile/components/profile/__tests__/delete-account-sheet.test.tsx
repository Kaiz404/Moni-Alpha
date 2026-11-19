import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { deleteAccount } from '@/lib/auth/account-functions';
import { dismissSheet, openSheet } from '@/lib/sheet/sheet-store';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({ height: { get: () => 0 }, state: { get: () => 0 } }),
}));
jest.mock('@/lib/auth/account-functions', () => ({ deleteAccount: jest.fn() }));
const mockShare = jest.fn();
jest.mock('@/components/profile/export-data-row', () => ({
  useExportCsv: () => ({ busy: false, share: mockShare }),
}));

afterEach(async () => {
  act(() => dismissSheet());
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
});

function openDeleteSheet() {
  render(<SheetHost />);
  let result: Promise<true | null> = Promise.resolve(null);
  act(() => {
    result = openSheet({ kind: 'deleteAccount', userId: 'user-1' });
  });
  return result;
}

const submit = () => screen.getByTestId('profile.delete.submit');

describe('Delete your account sheet', () => {
  it('says what goes in one line and offers Export data first', () => {
    void openDeleteSheet();
    expect(screen.getByText('Delete your account')).toBeTruthy();
    expect(screen.getByText('Everything Moni keeps for you goes for good, on every device.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('profile.delete.export'));
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  it('waits for DELETE in any letter case, then resolves once the account is gone', async () => {
    jest.mocked(deleteAccount).mockResolvedValue({ kind: 'ok', data: { ok: true } } as never);
    const result = openDeleteSheet();
    fireEvent.changeText(screen.getByTestId('profile.delete.confirm'), 'DELET');
    expect(submit().props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('profile.delete.confirm'), ' delete ');
    expect(submit().props.accessibilityState.disabled).toBe(false);
    fireEvent.press(submit());
    await expect(result).resolves.toBe(true);
  });

  it('stays open with the reason when the deletion fails', async () => {
    jest.mocked(deleteAccount).mockResolvedValue({ kind: 'unreachable' } as never);
    void openDeleteSheet();
    fireEvent.changeText(screen.getByTestId('profile.delete.confirm'), 'DELETE');
    await act(async () => fireEvent.press(submit()));
    expect(screen.getByText("Couldn't reach Moni. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByTestId('profile.delete.confirm')).toBeTruthy();
  });
});
