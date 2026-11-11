import { render, screen } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';

import { HoldMenu, type HoldAnchor } from '@/components/ui/hold-menu';
import { Page, PageScroll } from '@/components/ui/page';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

const anchor: HoldAnchor = {
  x: 120,
  y: 300,
  frame: { x: 20, y: 280, width: 350, height: 66 },
};

function Screen({ held }: { held: HoldAnchor | null }) {
  return (
    <>
      <Page
        screen="activity"
        kind="tabRoot"
        title="Activity"
        headerScrolls
      >
        <PageScroll>
          <Text>Rows</Text>
        </PageScroll>
      </Page>
      <HoldMenu
        screen="activity"
        anchor={held}
        liftedRow={<Text>Mamak Ali</Text>}
        rowTitle="Mamak Ali"
        onAction={() => {}}
        onClose={() => {}}
      />
    </>
  );
}

const scrollEnabled = () =>
  screen.UNSAFE_getByType(ScrollView).props.scrollEnabled as boolean;

describe('PageScroll under a hold menu', () => {
  it('stops scrolling while the menu is open, so the list stays under the lifted row', () => {
    render(<Screen held={null} />);
    expect(scrollEnabled()).toBe(true);
    screen.rerender(<Screen held={anchor} />);
    expect(scrollEnabled()).toBe(false);
    screen.rerender(<Screen held={null} />);
    expect(scrollEnabled()).toBe(true);
  });

  it('draws the header inside the scroll, under the status-bar padding', () => {
    render(<Screen held={null} />);
    const title = screen.getByText('Activity');
    let node = title.parent;
    while (node && node.type !== ScrollView) node = node.parent;
    expect(node).not.toBeNull();
  });
});
