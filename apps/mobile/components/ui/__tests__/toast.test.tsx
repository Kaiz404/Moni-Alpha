import {
  act,
  isHiddenFromAccessibility,
  render,
  screen,
} from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui/toast';
import { dismissToast, showToast } from '@/lib/toast/toast-store';

jest.mock('expo-router', () => ({ useSegments: () => ['review'] }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useAnimatedKeyboard: () => ({ height: { get: () => 0 } }),
  };
});
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  withUniwind: <T,>(component: T) => component,
}));

describe('ToastHost', () => {
  afterEach(() => act(() => dismissToast()));

  it('reads out the message and Undo, but not the time-left bar', () => {
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ToastHost />
      </SafeAreaProvider>,
    );
    act(() => showToast({ text: 'Counted once', undo: () => {} }));

    expect(screen.getByText('Counted once')).toBeTruthy();
    expect(
      isHiddenFromAccessibility(screen.getByLabelText('Undo')),
    ).toBe(false);
    expect(
      isHiddenFromAccessibility(
        screen.getByTestId('nav.toast.time-left', {
          includeHiddenElements: true,
        }),
      ),
    ).toBe(true);
  });
});
