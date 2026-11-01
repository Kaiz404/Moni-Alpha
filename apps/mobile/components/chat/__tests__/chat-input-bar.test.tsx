import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ChatInputBar } from '@/components/chat/chat-input-bar';
import { micGeometry, nextArmed, slideOf } from '@/components/chat/hold-to-talk';
import { holdCommit, thresholdOff, thresholdOn, toggleOff } from '@/lib/haptics';

jest.mock('@/lib/haptics', () => ({
  holdCommit: jest.fn(),
  thresholdOn: jest.fn(),
  thresholdOff: jest.fn(),
  toggleOff: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const HOLD = 'chat.mic.hold';
const TAP = 'chat.mic.tap';

// At 390 wide: the armed line is 142 left of home, and a mic falls off it again at 126.
const setup = () => {
  const props = { onListen: jest.fn(), onHoldStart: jest.fn(), onHoldEnd: jest.fn() };
  render(
    <ChatInputBar
      input=""
      onChangeText={jest.fn()}
      placeholder="Ask"
      autoFocus={false}
      attachedImage={null}
      onRemoveImage={jest.fn()}
      onOpenCamera={jest.fn()}
      onSend={jest.fn()}
      listening={false}
      onCancelListen={jest.fn()}
      onDoneListen={jest.fn()}
      level={{ get: () => 0, set: jest.fn() } as never}
      bottomInset={0}
      {...props}
    />,
  );
  return props;
};

// Async: a hold's callbacks reach React through scheduleOnRN, which runs in a later microtask.
const slideThrough = (...xs: number[]) =>
  act(async () => {
    fireGestureHandler(getByGestureTestId(HOLD), [
      { state: State.BEGAN, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, translationX: 0, velocityX: 0 },
      ...xs.map((translationX) => ({ state: State.ACTIVE, translationX, velocityX: 0 })),
      { state: State.END, translationX: xs.at(-1) ?? 0, velocityX: 0 },
    ]);
  });

/** One state change, as the phone sends it. fireGestureHandler can't fail a gesture before ACTIVE. */
const change = (id: string, oldState: number, state: number) =>
  DeviceEventEmitter.emit('onGestureHandlerStateChange', {
    handlerTag: getByGestureTestId(id).handlerTag,
    oldState,
    state,
    numberOfPointers: 1,
    translationX: 0,
    velocityX: 0,
  });

beforeEach(() => jest.clearAllMocks());

describe('ChatInputBar mic', () => {
  it('a quick tap ends the tap only after the hold has failed', async () => {
    const props = setup();
    await act(async () => {
      change(HOLD, State.UNDETERMINED, State.BEGAN);
      change(TAP, State.UNDETERMINED, State.BEGAN);
      change(HOLD, State.BEGAN, State.FAILED);
      change(TAP, State.BEGAN, State.ACTIVE);
      change(TAP, State.ACTIVE, State.END);
    });
    expect(props.onListen).toHaveBeenCalledTimes(1);
    expect(props.onHoldStart).not.toHaveBeenCalled();
    expect(holdCommit).not.toHaveBeenCalled();
  });

  it('a press that outlasts the hold delay cancels the tap', async () => {
    const props = setup();
    await act(async () => {
      change(HOLD, State.UNDETERMINED, State.BEGAN);
      change(TAP, State.UNDETERMINED, State.BEGAN);
      change(HOLD, State.BEGAN, State.ACTIVE);
      change(TAP, State.BEGAN, State.CANCELLED);
    });
    expect(props.onListen).not.toHaveBeenCalled();
    expect(props.onHoldStart).toHaveBeenCalledTimes(1);
    expect(holdCommit).toHaveBeenCalledTimes(1);
  });

  it('an accessibility tap opens the capsule, on either platform', () => {
    const props = setup();
    const mic = screen.getByLabelText('Talk to Moni');
    fireEvent(mic, 'accessibilityTap');
    fireEvent(mic, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(props.onListen).toHaveBeenCalledTimes(2);
  });

  it('holding talks, and letting go sends with a light tick', async () => {
    const props = setup();
    await slideThrough(0);
    expect(props.onHoldStart).toHaveBeenCalledTimes(1);
    expect(holdCommit).toHaveBeenCalledTimes(1);
    expect(props.onHoldEnd.mock.calls).toEqual([[true]]);
    expect(toggleOff).toHaveBeenCalledTimes(1);
    expect(props.onListen).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Talk to Moni')).toBeTruthy();
  });

  it('sliding past the line and letting go cancels, with one haptic and no send tick', async () => {
    const props = setup();
    await slideThrough(-50, -150, -200);
    expect(props.onHoldEnd.mock.calls).toEqual([[false]]);
    expect(thresholdOn).toHaveBeenCalledTimes(1);
    expect(thresholdOff).not.toHaveBeenCalled();
    expect(toggleOff).not.toHaveBeenCalled();
  });

  it('sliding short of the line still sends', async () => {
    const props = setup();
    await slideThrough(-141);
    expect(props.onHoldEnd.mock.calls).toEqual([[true]]);
    expect(thresholdOn).not.toHaveBeenCalled();
  });

  it('a finger jittering on the line fires one haptic each way', async () => {
    const props = setup();
    await slideThrough(-141, -143, -141, -130, -127, -143, -126);
    expect(thresholdOn).toHaveBeenCalledTimes(1);
    expect(thresholdOff).toHaveBeenCalledTimes(1);
    expect(props.onHoldEnd.mock.calls).toEqual([[true]]);
  });

  it('letting go inside the gap keeps what the mic last showed', async () => {
    const props = setup();
    await slideThrough(-143, -130);
    expect(props.onHoldEnd.mock.calls).toEqual([[false]]);
  });

  it('a slide and a release in one frame cancels from the release position', async () => {
    const props = setup();
    await act(async () => {
      fireGestureHandler(getByGestureTestId(HOLD), [
        { state: State.BEGAN, translationX: 0, velocityX: 0 },
        { state: State.ACTIVE, translationX: 0, velocityX: 0 },
        { state: State.END, translationX: -200, velocityX: -900 },
      ]);
    });
    expect(props.onHoldEnd.mock.calls).toEqual([[false]]);
  });

  it('an interrupted hold never sends', async () => {
    const props = setup();
    await act(async () => {
      fireGestureHandler(getByGestureTestId(HOLD), [
        { state: State.BEGAN, translationX: 0, velocityX: 0 },
        { state: State.ACTIVE, translationX: 0, velocityX: 0 },
        { state: State.CANCELLED, translationX: 0, velocityX: 0 },
      ]);
    });
    expect(props.onHoldEnd.mock.calls).toEqual([[false]]);
    expect(toggleOff).not.toHaveBeenCalled();
  });

  it('keeps the composer mounted under the capsule, and shows the words only while held', async () => {
    setup();
    expect(screen.queryByText('Let go to send')).toBeNull();
    await act(async () => {
      change(HOLD, State.UNDETERMINED, State.BEGAN);
      change(HOLD, State.BEGAN, State.ACTIVE);
    });
    expect(screen.getByText('Let go to send')).toBeTruthy();
    expect(screen.getByTestId('chat.input')).toBeTruthy();
    await act(async () => change(HOLD, State.ACTIVE, State.END));
    expect(screen.queryByText('Let go to send')).toBeNull();
  });
});

describe('the mic slide', () => {
  const geometry = micGeometry(390);

  it('has the distances of a 390 phone', () => {
    expect(geometry).toEqual({ trash: 311, stop: 259, cancelAt: 142, rearmAt: 126, radius: 390 });
  });

  it('never goes right of home or past where it waits by the trash', () => {
    expect(slideOf(50, geometry.stop)).toBe(0);
    expect(slideOf(-100, geometry.stop)).toBe(100);
    expect(slideOf(-900, geometry.stop)).toBe(259);
  });

  it('arms at the line and falls off only past the gap', () => {
    expect(nextArmed(false, 141, geometry)).toBe(false);
    expect(nextArmed(false, 142, geometry)).toBe(true);
    expect(nextArmed(true, 127, geometry)).toBe(true);
    expect(nextArmed(true, 126, geometry)).toBe(false);
  });
});
