import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import { Segmented } from '@/components/ui/segmented';
import { glidePickUp, glideSnap } from '@/lib/haptics';

jest.mock('@/lib/haptics', () => ({
  scrubStep: jest.fn(),
  glidePickUp: jest.fn(),
  glideSnap: jest.fn(),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));

const RANGES = [
  { value: '1m', label: '1M' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '1y', label: '1Y' },
] as const;

/** 4 segments of 70 after the 4 inset: option i's centre is at x = 4 + 35 + 70 i. */
const centre = (i: number) => 39 + 70 * i;

function renderRange(onChange: (value: string) => void) {
  render(
    <Segmented
      screen="home"
      name="range"
      size="compact"
      segmentWidth={70}
      accessibilityLabel="Range"
      options={RANGES}
      value="1m"
      onChange={onChange}
    />,
  );
}

const glide = (id: string, path: number[], velocityX = 0) =>
  act(async () => {
    fireGestureHandler(getByGestureTestId(id), [
      { state: State.BEGAN, x: path[0], y: 18 },
      { state: State.ACTIVE, x: path[0], y: 18 },
      ...path.slice(1).map((x) => ({ x, y: 18, velocityX })),
      { state: State.END, x: path[path.length - 1], y: 18, velocityX },
    ]);
  });

describe('Segmented glide', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lands on the option the finger let go over, with one pick-up and one landing haptic', async () => {
    const onChange = jest.fn();
    renderRange(onChange);
    await glide('home.range.glide', [centre(0), centre(1), centre(2) + 10]);
    expect(onChange).toHaveBeenLastCalledWith('30d');
    expect(glidePickUp).toHaveBeenCalledTimes(1);
    expect(glideSnap).toHaveBeenCalledTimes(1);
  });

  it('holds the last option when the finger runs far past the end', async () => {
    const onChange = jest.fn();
    renderRange(onChange);
    await glide('home.range.glide', [centre(0), centre(3), centre(3) + 400]);
    expect(onChange).toHaveBeenCalledWith('1y');
  });

  it('stays put and changes nothing when a hold is let go where it began', async () => {
    const onChange = jest.fn();
    renderRange(onChange);
    await glide('home.range.hold', [centre(0), centre(0) - 300]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('carries a flick on to the next option', async () => {
    const onChange = jest.fn();
    renderRange(onChange);
    await glide('home.range.glide', [centre(0), centre(1) - 20], 1500);
    expect(onChange).toHaveBeenCalledWith('7d');
  });
});
