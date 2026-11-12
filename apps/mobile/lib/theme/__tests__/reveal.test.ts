import { act, renderHook } from '@testing-library/react-native';
import { Uniwind } from 'uniwind';

import { getThemePreference } from '@/lib/theme/preference';
import { switchTheme, useRevealHeldTheme } from '@/lib/theme/reveal';
import { useThemeCommit } from '@/lib/theme/theme-commit';

type Native = {
  capture: jest.Mock<Promise<boolean>, []>;
  reveal: jest.Mock<Promise<void>, [number, number, number]>;
};

const mockNative: { current: Native | null } = { current: null };

jest.mock('moni-theme-reveal', () => ({
  get themeReveal() {
    return mockNative.current;
  },
}));
jest.mock('uniwind', () => ({
  Uniwind: { setTheme: jest.fn(), currentTheme: 'light' },
}));

const setTheme = jest.mocked(Uniwind.setTheme);
const origin = { x: 78, y: 322 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function native(): Native {
  return {
    capture: jest.fn(() => Promise.resolve(true)),
    reveal: jest.fn(() => Promise.resolve()),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  setTheme.mockClear();
  mockNative.current = native();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('switchTheme', () => {
  it('switches at once with no circle when the native module is missing', async () => {
    mockNative.current = null;
    await switchTheme('dark', origin);

    expect(setTheme.mock.calls).toEqual([['dark']]);
    expect(getThemePreference()).toBe('dark');
  });

  it('switches at once when no origin was measured', async () => {
    const reveal = mockNative.current!;
    await switchTheme('dark');

    expect(setTheme.mock.calls).toEqual([['dark']]);
    expect(reveal.capture).not.toHaveBeenCalled();
  });

  it('covers the screen first, then switches, then opens the circle from the origin', async () => {
    const reveal = mockNative.current!;
    const shot = deferred<boolean>();
    reveal.capture.mockReturnValue(shot.promise);

    const running = switchTheme('dark', origin);
    expect(setTheme).not.toHaveBeenCalled();

    shot.resolve(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(setTheme.mock.calls).toEqual([['dark']]);
    expect(reveal.reveal).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);
    await running;
    expect(reveal.reveal.mock.calls).toEqual([[78, 322, 650, [0.5, 0, 0.75, 0]]]);
  });

  it('opens the circle as soon as the new theme commits, not after the wait', async () => {
    const reveal = mockNative.current!;
    const root = renderHook(({ theme }) => useThemeCommit(theme), {
      initialProps: { theme: 'light' },
    });

    const running = switchTheme('dark', origin);
    await jest.advanceTimersByTimeAsync(0);
    expect(setTheme.mock.calls).toEqual([['dark']]);
    root.rerender({ theme: 'dark' });
    await jest.advanceTimersByTimeAsync(100);

    expect(reveal.reveal).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    await running;
  });

  it('applies only the last pick made while the screenshot is being taken', async () => {
    const reveal = mockNative.current!;
    const shot = deferred<boolean>();
    reveal.capture.mockReturnValue(shot.promise);

    const running = switchTheme('dark', origin);
    await switchTheme('system', origin);
    await switchTheme('light', origin);
    expect(setTheme).not.toHaveBeenCalled();

    shot.resolve(true);
    await jest.advanceTimersByTimeAsync(1000);
    await running;
    expect(setTheme.mock.calls).toEqual([['light']]);
    expect(reveal.capture).toHaveBeenCalledTimes(1);
    expect(reveal.reveal).toHaveBeenCalledTimes(1);
  });

  it('recolours under a running reveal instead of starting another', async () => {
    const reveal = mockNative.current!;
    const opening = deferred<void>();
    reveal.reveal.mockReturnValue(opening.promise);

    const running = switchTheme('dark', origin);
    await jest.advanceTimersByTimeAsync(1000);
    expect(reveal.reveal).toHaveBeenCalledTimes(1);

    await switchTheme('light', origin);
    expect(setTheme.mock.calls).toEqual([['dark'], ['light']]);
    expect(reveal.capture).toHaveBeenCalledTimes(1);

    opening.resolve();
    await running;
    const again = switchTheme('dark', origin);
    await jest.advanceTimersByTimeAsync(1000);
    await again;
    expect(reveal.capture).toHaveBeenCalledTimes(2);
  });

  it('still switches, without a circle, when the screenshot fails', async () => {
    const reveal = mockNative.current!;
    reveal.capture.mockRejectedValue(new Error('PixelCopy failed'));

    await switchTheme('dark', origin);

    expect(setTheme.mock.calls).toEqual([['dark']]);
    expect(reveal.reveal).not.toHaveBeenCalled();
  });

  it('keeps the old theme for the status bar until the circle has opened', async () => {
    const reveal = mockNative.current!;
    const opening = deferred<void>();
    reveal.reveal.mockReturnValue(opening.promise);
    const { result } = renderHook(() => useRevealHeldTheme());
    expect(result.current).toBeNull();

    let running!: Promise<void>;
    await act(async () => {
      running = switchTheme('dark', origin);
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(setTheme.mock.calls).toEqual([['dark']]);
    expect(result.current).toBe('light');

    await act(async () => {
      opening.resolve();
      await running;
    });
    expect(result.current).toBeNull();
  });
});

