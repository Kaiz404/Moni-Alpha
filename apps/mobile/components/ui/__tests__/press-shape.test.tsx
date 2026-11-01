import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { withSpring } from 'react-native-reanimated';

import { ListCard, ListSection } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { tid } from '@/lib/test-ids';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
// Worklets read the pressed end of each interpolation, so a test sees where the press lands.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  interpolate: (_value: number, _input: number[], output: number[]) =>
    output[output.length - 1],
  useReducedMotion: () => false,
  withSpring: jest.fn((toValue: number) => toValue),
}));

const ROW = tid('home', 'recent', 'see-all');
const CHIP = tid('home', 'ask-box');

function fills(): string[] {
  const found: string[] = [];
  const walk = (node: ReactTestRendererJSON | string | null) => {
    if (node === null || typeof node === 'string') return;
    const className = node.props.className as string | undefined;
    if (className?.startsWith('absolute inset-0')) {
      found.push(className.replace('absolute inset-0', '').trim());
    }
    node.children?.forEach(walk);
  };
  const root = screen.toJSON();
  (Array.isArray(root) ? root : [root]).forEach(walk);
  return found;
}

function pressedScale(testID: string): number {
  const { transform } = StyleSheet.flatten(
    screen.getByTestId(testID).props.style,
  ) as { transform: { scale: number }[] };
  return transform[0]!.scale;
}

describe('Press feedback follows the pressed shape', () => {
  it('draws no fill on a Press with no corners and no row around it', () => {
    render(<Press testID={ROW} pressedClassName="bg-hairline" />);
    expect(fills()).toEqual([]);
    expect(pressedScale(ROW)).toBe(0.97);
  });

  it('fills a Press that has its own corners, from a class or from radius', () => {
    const { rerender } = render(
      <Press
        testID={ROW}
        className="h-11 rounded-full"
      />,
    );
    expect(fills()).toEqual(['bg-sand-light']);
    rerender(
      <Press
        testID={ROW}
        pressedClassName="bg-hairline"
        radius={{ rest: 22, pressed: 16 }}
      />,
    );
    expect(fills()).toEqual(['bg-hairline']);
  });

  it('makes a cornerless Press in a ListCard a flush row that does not scale', () => {
    render(
      <ListCard>
        <Press testID={ROW} />
      </ListCard>,
    );
    expect(fills()).toEqual(['bg-sand-light']);
    expect(pressedScale(ROW)).toBe(1);
  });

  it('gives the rows of a ListSection the same feedback, through the row wrappers', () => {
    render(
      <ListSection label="Today">
        <View>
          <Press testID={ROW} />
        </View>
      </ListSection>,
    );
    expect(fills()).toEqual(['bg-sand-light']);
    expect(pressedScale(ROW)).toBe(1);
  });

  it('leaves a rounded chip inside a card row squishing on its own shape', () => {
    render(
      <ListCard>
        <View>
          <Press
            testID={CHIP}
            radius={{ rest: 18, pressed: 16 }}
          />
        </View>
      </ListCard>,
    );
    expect(fills()).toEqual(['bg-sand-light']);
    expect(pressedScale(CHIP)).toBe(0.97);
  });

  it('does not treat a Press nested inside a row as another row', () => {
    render(
      <ListCard>
        <Press testID={ROW}>
          <Press testID={CHIP}>
            <Text>Inner</Text>
          </Press>
        </Press>
      </ListCard>,
    );
    expect(fills()).toEqual(['bg-sand-light']);
    expect(pressedScale(ROW)).toBe(1);
    expect(pressedScale(CHIP)).toBe(0.97);
  });

  it('lets the card reach its rows: no vertical padding, and it clips', () => {
    render(
      <ListCard>
        <Press testID={ROW} />
      </ListCard>,
    );
    const card = screen.toJSON() as ReactTestRendererJSON;
    expect(card.props.className).toContain('overflow-hidden');
    expect(card.props.className).toContain('rounded-card');
    expect(card.props.className).not.toMatch(/(^|\s)p[ytb]?-/);
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const;

  it('shows nothing square while a segment is held', () => {
    render(
      <Segmented
        screen="profile"
        name="appearance"
        accessibilityLabel="Appearance"
        options={options}
        value="light"
        onChange={jest.fn()}
      />,
    );
    expect(fills().filter((fill) => fill !== 'bg-transparent')).toEqual([]);
  });

  it('starts the pill before the owner of the value does its work', () => {
    const springs = withSpring as unknown as jest.Mock;
    springs.mockClear();
    let targetAtChange: unknown;
    render(
      <Segmented
        screen="profile"
        name="appearance"
        accessibilityLabel="Appearance"
        options={options}
        value="light"
        onChange={() => {
          targetAtChange = springs.mock.calls[0]?.[0];
        }}
      />,
    );
    fireEvent.press(screen.getByTestId('profile.appearance.dark'));
    expect(targetAtChange).toBe(1);
  });

  it('follows a value changed from outside, once', () => {
    const springs = withSpring as unknown as jest.Mock;
    const segmented = (value: 'light' | 'dark') => (
      <Segmented
        screen="profile"
        name="appearance"
        accessibilityLabel="Appearance"
        options={options}
        value={value}
        onChange={jest.fn()}
      />
    );
    const { rerender } = render(segmented('light'));
    springs.mockClear();
    rerender(segmented('dark'));
    rerender(segmented('dark'));
    expect(springs.mock.calls.map((call) => call[0])).toEqual([1]);
  });
});
