import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { glideSnap, holdCommit, scrubStep } from '@/lib/haptics';
import { walletGroups, type FinanceWallet } from '@repo/core';
import type { MinorAmount } from '@repo/types';

import { WalletStrip } from '../wallet-strip';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('@/lib/haptics', () => ({
  holdCommit: jest.fn(),
  scrubStep: jest.fn(),
  glideSnap: jest.fn(),
}));

const wallet = (id: string, name: string, type: string, currency: 'MYR' | 'USD', displayOrder: number) =>
  ({ id, name, type, currency, displayOrder, cardStyleId: null, icon: null, isActive: true }) as FinanceWallet;

const WALLETS = [
  wallet('maybank', 'Maybank', 'bank', 'MYR', 0),
  wallet('tng', "Touch 'n Go", 'ewallet', 'MYR', 1),
  wallet('cash', 'Cash', 'cash', 'MYR', 2),
  wallet('wise', 'Wise', 'bank', 'USD', 3),
];
const BALANCES = { maybank: 228180, tng: 8640, cash: 6360, wise: 12000 } as Record<string, MinorAmount>;

function renderStrip() {
  const onOpen = jest.fn();
  const onAdd = jest.fn();
  const onReorder = jest.fn();
  render(
    <WalletStrip
      groups={walletGroups(WALLETS, BALANCES, 'MYR')}
      balances={BALANCES}
      onOpen={onOpen}
      onAdd={onAdd}
      onReorder={onReorder}
    />,
  );
  return { onOpen, onAdd, onReorder };
}

/** A hold on one card, then a drag of `dx` along the strip, then the drop. */
const holdAndDrag = (id: string, dx: number) =>
  act(async () => {
    fireGestureHandler(getByGestureTestId(`home.wallets.${id}.hold`), [
      { state: State.BEGAN, translationX: 0, absoluteX: 100 },
      { state: State.ACTIVE, translationX: 0, absoluteX: 100 },
      { translationX: dx / 2, absoluteX: 100 + dx / 2 },
      { translationX: dx, absoluteX: 100 + dx },
      { state: State.END, translationX: dx, absoluteX: 100 + dx },
    ]);
  });

describe('WalletStrip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows each wallet in its own currency, then New wallet', () => {
    renderStrip();
    expect(screen.getByLabelText('Maybank, RM2,281.80')).toBeTruthy();
    expect(screen.getByLabelText("Touch 'n Go, RM86.40")).toBeTruthy();
    expect(screen.getByLabelText('Wise, US$120.00')).toBeTruthy();
    expect(screen.getByTestId('home.wallets.new')).toBeTruthy();
  });

  it('opens a wallet on a tap and the wallet form from New wallet', () => {
    const { onOpen, onAdd } = renderStrip();
    fireEvent.press(screen.getByTestId('home.wallets.card.tng'));
    fireEvent.press(screen.getByTestId('home.wallets.new'));
    expect(onOpen).toHaveBeenCalledWith('tng');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('saves the order a held card is dropped in, with a lift, a tick a swap and a landing', async () => {
    const { onReorder } = renderStrip();
    await holdAndDrag('maybank', 2 * 158 + 10);
    expect(onReorder).toHaveBeenCalledWith(['tng', 'cash', 'maybank', 'wise']);
    expect(holdCommit).toHaveBeenCalledTimes(1);
    expect(scrubStep).toHaveBeenCalledTimes(2);
    expect(glideSnap).toHaveBeenCalledTimes(1);
  });

  it('stops a card at its currency divider', async () => {
    const { onReorder } = renderStrip();
    await holdAndDrag('tng', 5 * 158);
    expect(onReorder).toHaveBeenCalledWith(['maybank', 'cash', 'tng', 'wise']);
  });

  it('saves nothing when a card is dropped back in its own slot', async () => {
    const { onReorder } = renderStrip();
    await holdAndDrag('cash', 60);
    expect(onReorder).not.toHaveBeenCalled();
    expect(glideSnap).toHaveBeenCalledTimes(1);
  });
});
