import 'react-native-gesture-handler/jestSetup';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import { openCaptureChooser } from '@/components/nav/capture-chooser';
import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { dismissSheet, getOpenSheet } from '@/lib/sheet/sheet-store';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 48,
    bottom: 24,
    left: 0,
    right: 0,
  }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({
    height: { get: () => 0 },
    state: { get: () => 0 },
  }),
}));

const flush = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

/** Returns the chooser's promise boxed, so awaiting the helper does not wait for a pick. */
function openChooser() {
  render(
    <>
      <SheetHost />
      <SheetHost layer="tabs" />
    </>,
  );
  let chosen!: Promise<void>;
  act(() => {
    chosen = openCaptureChooser();
  });
  return { chosen };
}

beforeEach(() => jest.mocked(router.push).mockClear());
afterEach(async () => {
  act(() => dismissSheet());
  await flush();
});

describe('capture chooser', () => {
  it('lists the four ways to add a transaction, with the + as Close', () => {
    openChooser();

    expect(screen.getByText('Add a transaction')).toBeTruthy();
    expect(
      ['type', 'scan', 'say', 'ask'].map(
        (id) =>
          screen.getByTestId(`nav.chooser.${id}`).props
            .accessibilityLabel,
      ),
    ).toEqual(['Type it', 'Scan a receipt', 'Say it', 'Ask Moni']);
    expect(
      screen.getByTestId('nav.chooser.close').props
        .accessibilityLabel,
    ).toBe('Close');
  });

  it('renders in the tabs layer only, so pushed pages slide in above it', () => {
    render(<SheetHost />);
    act(() => {
      void openCaptureChooser();
    });

    expect(screen.queryByText('Add a transaction')).toBeNull();
  });

  it('closes the sheet and pushes the listening page for Say it', async () => {
    const { chosen } = openChooser();

    fireEvent.press(screen.getByTestId('nav.chooser.say'));
    await flush();
    await chosen;

    expect(router.push).toHaveBeenCalledWith('/capture/say');
    expect(getOpenSheet()).toBeNull();
  });

  it('pushes Moni chat for Ask Moni', async () => {
    const { chosen } = openChooser();

    fireEvent.press(screen.getByTestId('nav.chooser.ask'));
    await flush();
    await chosen;

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chat',
      params: { focus: '1' },
    });
  });

  it('pushes nothing when the × closes it', async () => {
    const { chosen } = openChooser();

    fireEvent.press(screen.getByTestId('nav.chooser.close'));
    await flush();
    await chosen;

    expect(router.push).not.toHaveBeenCalled();
    expect(getOpenSheet()).toBeNull();
  });
});
