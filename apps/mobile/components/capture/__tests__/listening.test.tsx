import { fireEvent, render, screen } from '@testing-library/react-native';

import { Listening } from '@/components/capture/listening';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));

describe('Listening', () => {
  it('shows the timer and the words, with no offline chip', () => {
    render(
      <Listening
        seconds={32}
        transcript=""
        level={{ get: () => 0.5 } as never}
        onDone={jest.fn()}
        onStartOver={jest.fn()}
      />,
    );
    expect(screen.getByTestId('capture.timer')).toHaveTextContent('0:32');
    expect(screen.getByText('Listening…')).toBeTruthy();
    expect(screen.queryByText(/works offline/)).toBeNull();
  });

  it('starts over once there are words to clear', () => {
    const onStartOver = jest.fn();
    const props = {
      seconds: 4,
      level: { get: () => 0 } as never,
      onDone: jest.fn(),
      onStartOver,
    };
    const { rerender } = render(<Listening {...props} transcript="" />);
    fireEvent.press(screen.getByTestId('capture.start-over'));
    expect(onStartOver).not.toHaveBeenCalled();

    rerender(<Listening {...props} transcript="Grab fifty ringgit" />);
    fireEvent.press(screen.getByTestId('capture.start-over'));
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });
});
