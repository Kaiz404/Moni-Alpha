import { render, screen } from '@testing-library/react-native';

import { SquareCard } from '@/components/debt/debt-standing';
import type { DebtLine } from '@repo/core';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

const line = {
  debt: { id: 'ali', direction: 'owed_to_me', counterpartyName: 'Ali', currency: 'MYR' },
  principalMinor: 5000,
  repaidMinor: 5000,
  balanceMinor: 0,
  state: 'settled',
  startedAt: '2026-10-01T10:00:00Z',
  lastAt: '2026-10-20T10:00:00Z',
} as unknown as DebtLine;

describe('SquareCard', () => {
  it('leads the settled card with the celebrating cat', () => {
    render(
      <SquareCard
        line={line}
        pop
      />,
    );
    expect(screen.getByText('All square with Ali')).toBeTruthy();
    expect(screen.getByLabelText('Moni, celebrate')).toBeTruthy();
  });
});
