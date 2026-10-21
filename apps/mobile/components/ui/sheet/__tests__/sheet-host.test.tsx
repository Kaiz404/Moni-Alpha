import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { MinorAmount } from '@repo/types';

import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { dismissSheet, openSheet } from '@/lib/sheet/sheet-store';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({ height: { get: () => 0 }, state: { get: () => 0 } }),
}));
jest.mock('@/lib/finance/main-currency', () => ({
  useMainCurrency: () => 'MYR',
}));

const rm = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;
const tile = (id: string, name: string, spent: number, budget: number | null) => ({
  id,
  name,
  icon: null,
  color: null,
  spentMinor: rm(spent),
  budgetMinor: budget === null ? null : rm(budget),
});

afterEach(async () => {
  act(() => dismissSheet());
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
});

describe('SheetHost', () => {
  it('resolves a confirm sheet to true when its action is pressed', async () => {
    render(<SheetHost />);
    let answer!: Promise<true | null>;
    act(() => {
      answer = openSheet({
        kind: 'confirm',
        title: 'Delete Maybank?',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep it',
        destructive: true,
      });
    });

    expect(screen.getByText('Delete Maybank?')).toBeTruthy();
    expect(screen.getByText('Keep it')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet.confirm'));

    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await expect(answer).resolves.toBe(true);
  });

  it('resolves to null when the scrim is pressed', async () => {
    render(<SheetHost />);
    let answer!: Promise<string | null>;
    act(() => {
      answer = openSheet({ kind: 'currency', selected: 'MYR' });
    });

    fireEvent.press(screen.getByTestId('sheet.scrim'));

    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await expect(answer).resolves.toBeNull();
  });

  it('filters category tiles by search and resolves to the tapped tile', async () => {
    render(<SheetHost />);
    let answer!: Promise<string | null>;
    act(() => {
      answer = openSheet({
        kind: 'category',
        title: 'Choose category',
        currency: 'MYR',
        selectedId: null,
        categories: [
          tile('food', 'Food & Dining', 80, 100),
          tile('transport', 'Transport', 140, 120),
          tile('travel', 'Travel', 0, null),
        ],
      });
    });

    expect(screen.getByText('RM20 left')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('sheet.search'), 'Tra');

    expect(screen.queryByText('Food & Dining')).toBeNull();
    expect(screen.getByText('RM20 over')).toBeTruthy();
    expect(screen.getByText('Nothing yet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet.category.travel'));

    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await expect(answer).resolves.toBe('travel');
  });

  it('resolves a wallet sheet with no default to walletId null from its None row', async () => {
    render(<SheetHost />);
    let answer!: Promise<{ walletId: string | null } | null>;
    act(() => {
      answer = openSheet({
        kind: 'wallet',
        title: 'Default wallet',
        selectedId: 'w1',
        noneLabel: 'None',
        wallets: [
          {
            id: 'w1',
            name: 'Maybank',
            currency: 'MYR',
            type: 'bank',
            icon: null,
            color: null,
            cardStyleId: null,
          },
        ],
      });
    });

    fireEvent.press(screen.getByTestId('sheet.option.none'));

    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await expect(answer).resolves.toEqual({ walletId: null });
  });
});
