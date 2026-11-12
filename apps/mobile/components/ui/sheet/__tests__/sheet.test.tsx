import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import { Sheet, SheetScrollView } from '@/components/ui/sheet/sheet';

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

describe('Sheet body drag', () => {
  function renderList(onDismiss: () => void) {
    render(
      <Sheet
        open
        onDismiss={onDismiss}
        onExited={jest.fn()}
        title="Edit category"
        size="large"
      >
        <SheetScrollView testID="sheet.list">
          <Text>Food & Dining</Text>
        </SheetScrollView>
      </Sheet>,
    );
    // The sheet measures 600 tall, as it would on the phone.
    fireEvent(screen.getByTestId('sheet.bleed').parent!, 'layout', {
      nativeEvent: { layout: { height: 600 } },
    });
  }

  const dragDown = () =>
    act(async () => {
      fireGestureHandler(getByGestureTestId('sheet.body.drag'), [
        { state: State.BEGAN, translationY: 0, velocityY: 0 },
        { state: State.ACTIVE, translationY: 40, velocityY: 900 },
        { translationY: 320, velocityY: 1400 },
        { state: State.END, translationY: 320, velocityY: 1400 },
      ]);
    });

  const scrollListTo = (y: number) =>
    fireEvent.scroll(screen.getByTestId('sheet.list'), {
      nativeEvent: { contentOffset: { y } },
    });

  it('closes when the list is already at its top and the finger pulls down', async () => {
    const onDismiss = jest.fn();
    renderList(onDismiss);
    await dragDown();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('stays open when the drag starts with the list scrolled down', async () => {
    const onDismiss = jest.fn();
    renderList(onDismiss);
    scrollListTo(240);
    await dragDown();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('closes on the next pull once the list is back at its top', async () => {
    const onDismiss = jest.fn();
    renderList(onDismiss);
    scrollListTo(240);
    await dragDown();
    scrollListTo(0);
    await dragDown();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
