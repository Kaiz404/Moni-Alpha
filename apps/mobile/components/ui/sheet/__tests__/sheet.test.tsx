import 'react-native-gesture-handler/jestSetup';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Sheet } from '@/components/ui/sheet/sheet';

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
  useAnimatedKeyboard: () => ({
    height: { get: () => 0 },
    state: { get: () => 0 },
  }),
}));

const TALLEST_PHONE = 1000;

describe.each(['fit', 'large'] as const)('Sheet size %s', (size) => {
  it('hangs Cream below its bottom edge, past any overshoot, out of the layout', () => {
    render(
      <Sheet
        open
        onDismiss={jest.fn()}
        onExited={jest.fn()}
        title="Wallet"
        size={size}
      />,
    );
    const bleed = StyleSheet.flatten(
      screen.getByTestId('sheet.bleed').props.style,
    ) as { bottom: number; height: number; position: string };
    expect(bleed.position).toBe('absolute');
    // It joins the sheet: its top edge sits at or above the sheet's bottom.
    expect(bleed.bottom + bleed.height).toBeGreaterThan(0);
    // A drag rubber-bands towards the sheet's height, so a screen is the bound.
    expect(-bleed.bottom).toBeGreaterThanOrEqual(TALLEST_PHONE);
    expect(screen.getByTestId('sheet.bleed').props.className).toContain(
      'bg-canvas',
    );
  });
});
