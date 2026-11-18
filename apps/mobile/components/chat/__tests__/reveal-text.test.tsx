import { act, render, screen } from '@testing-library/react-native';

import { RevealText, wordEnds } from '@/components/chat/reveal-text';
import { isFresh, markFresh } from '@/lib/ai/chat/fresh-replies';

let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReduceMotion,
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));

const REPLY = 'You spent RM212.40 on Transport this month, mostly Grab rides.';

function shownText(): string {
  return screen.getByTestId('reply').props.children as string;
}

describe('RevealText', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduceMotion = false;
  });
  afterEach(() => jest.useRealTimers());

  it('streams a fresh reply in word by word, whole words only, then shows all of it', () => {
    markFresh('fresh-1');
    render(
      <RevealText
        messageId="fresh-1"
        text={REPLY}
        color="#FFFFFF"
        testID="reply"
      />,
    );
    expect(shownText()).toBe('You');

    act(() => jest.advanceTimersByTime(200));
    const partway = shownText();
    expect(REPLY.startsWith(partway)).toBe(true);
    expect(partway.length).toBeGreaterThan('You'.length);
    expect(partway.length).toBeLessThan(REPLY.length);
    expect(wordEnds(REPLY)).toContain(partway.length);

    act(() => jest.advanceTimersByTime(2200));
    expect(shownText()).toBe(REPLY);
    expect(isFresh('fresh-1')).toBe(false);
  });

  it('shows the whole reply at once under Reduce Motion', () => {
    mockReduceMotion = true;
    markFresh('fresh-2');
    render(
      <RevealText
        messageId="fresh-2"
        text={REPLY}
        color="#FFFFFF"
        testID="reply"
      />,
    );
    expect(shownText()).toBe(REPLY);
  });

  it('shows a reopened reply whole', () => {
    render(
      <RevealText
        messageId="old-1"
        text={REPLY}
        color="#FFFFFF"
        testID="reply"
      />,
    );
    expect(shownText()).toBe(REPLY);
  });
});
