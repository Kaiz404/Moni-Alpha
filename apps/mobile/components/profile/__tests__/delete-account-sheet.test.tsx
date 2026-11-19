import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

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
  jest.restoreAllMocks();
  act(() => dismissSheet());
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
});

const onDeleted = jest.fn(async () => {});

function openDeleteSheet() {
  render(<SheetHost />);
  let result: Promise<true | null> = Promise.resolve(null);
  act(() => {
    result = openSheet({ kind: 'deleteAccount', userId: 'user-1', onDeleted });
  });
  return result;
}

/** Android calls the newest back listener first and stops at the first that returns true. */
function pressBack(handlers: (() => boolean | null | undefined)[]) {
  act(() => {
    [...handlers].reverse().some((handler) => handler());
  });
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
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('holds while the deletion is out and still runs onDeleted when the sheet goes anyway', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) && undefined };
    });
    let finish: (value: unknown) => void = () => {};
    jest.mocked(deleteAccount).mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
    onDeleted.mockClear();
    const result = openDeleteSheet();
    fireEvent.changeText(screen.getByTestId('profile.delete.confirm'), 'DELETE');
    fireEvent.press(submit());

    const cancel = screen.getByTestId('profile.delete.cancel');
    expect(cancel.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(cancel);
    fireEvent.press(screen.getByTestId('sheet.scrim'));
    pressBack(handlers);
    expect(screen.getByTestId('profile.delete.confirm')).toBeTruthy();

    act(() => dismissSheet());
    await expect(result).resolves.toBeNull();
    expect(onDeleted).not.toHaveBeenCalled();

    await act(async () => finish({ kind: 'ok', data: { ok: true } }));
    expect(onDeleted).toHaveBeenCalledTimes(1);
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
