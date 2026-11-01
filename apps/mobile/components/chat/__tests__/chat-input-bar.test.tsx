import { render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ChatInputBar } from '@/components/chat/chat-input-bar';

jest.mock('@/lib/haptics', () => ({ holdCommit: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const setup = (input = '') => {
  const props = { onListen: jest.fn(), onHoldStart: jest.fn(), onHoldEnd: jest.fn() };
  render(
    <ChatInputBar
      input={input}
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

describe('ChatInputBar mic', () => {
  it('a tap opens the capsule without starting a hold', () => {
    const props = setup();
    fireGestureHandler(getByGestureTestId('chat.mic.tap'), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]);
    expect(props.onListen).toHaveBeenCalledTimes(1);
    expect(props.onHoldStart).not.toHaveBeenCalled();
  });

  it('holding talks, and letting go sends', () => {
    const props = setup();
    fireGestureHandler(getByGestureTestId('chat.mic.hold'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0 },
      { state: State.END },
    ]);
    expect(props.onHoldStart).toHaveBeenCalledTimes(1);
    expect(props.onHoldEnd).toHaveBeenCalledWith(true);
    expect(props.onListen).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Talk to Moni')).toBeTruthy();
  });

  it('sliding left before letting go cancels instead of sending', () => {
    const props = setup();
    fireGestureHandler(getByGestureTestId('chat.mic.hold'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0 },
      { state: State.ACTIVE, translationX: -100 },
      { state: State.END, translationX: -100 },
    ]);
    expect(props.onHoldEnd).toHaveBeenCalledWith(false);
  });

  it('sliding a little still sends', () => {
    const props = setup();
    fireGestureHandler(getByGestureTestId('chat.mic.hold'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0 },
      { state: State.ACTIVE, translationX: -40 },
      { state: State.END, translationX: -40 },
    ]);
    expect(props.onHoldEnd).toHaveBeenCalledWith(true);
  });
});
