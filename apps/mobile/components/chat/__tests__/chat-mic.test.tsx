import { act, render, screen } from '@testing-library/react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { DeviceEventEmitter } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import ChatScreen from '@/app/chat';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({ height: { get: () => 0 } }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: { start: jest.fn(), stop: jest.fn(), abort: jest.fn() },
  useSpeechRecognitionEvent: jest.fn(),
}));
jest.mock('@/lib/speech/speech-recognition', () => ({
  ...jest.requireActual('@/lib/speech/speech-recognition'),
  buildSpeechRecognitionOptions: () => ({ lang: 'en-US' }),
  ensureSpeechPermissions: async () => true,
  prepareOfflineSpeechModel: async () => undefined,
}));
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1', user_metadata: {} } }),
}));
jest.mock('@/lib/ai/chat/orchestrator', () => ({
  handleQuickReply: jest.fn(),
  sendChatMessage: jest.fn(),
}));
jest.mock('@/lib/ai/chat/answer-snapshot', () => ({ buildAnswerSnapshot: jest.fn(() => null) }));
jest.mock('@/lib/ai/chat/noticed', () => ({ noticedItems: () => [] }));
jest.mock('@/lib/finance/selectors', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { pendingProposals$: () => observable([]) };
});
jest.mock('@/lib/receipts/scan-receipt', () => ({ scanAndNormalizeReceipt: jest.fn() }));
jest.mock('@/lib/supabase/proposed-transactions', () => ({ isAwaitingReview: () => false }));
jest.mock('@/lib/haptics', () => ({
  holdCommit: jest.fn(),
  thresholdOn: jest.fn(),
  thresholdOff: jest.fn(),
  toggleOff: jest.fn(),
}));
jest.mock('@/modules/moni-android-apps', () => ({
  __esModule: true,
  default: { setKeyboardPansWindowAsync: jest.fn() },
}));

const CAPSULE = 'Listening. Tap Done to send.';
const start = jest.mocked(ExpoSpeechRecognitionModule.start);

const change = (id: string, oldState: number, state: number, translationX = 0) =>
  DeviceEventEmitter.emit('onGestureHandlerStateChange', {
    handlerTag: getByGestureTestId(id).handlerTag,
    oldState,
    state,
    numberOfPointers: 1,
    translationX,
    velocityX: 0,
  });

const HOLD = 'chat.mic.hold';
const TAP = 'chat.mic.tap';

/**
 * These emit each change in the order a phone delivers them. fireGestureHandler can't: it drives
 * one gesture at a time and always passes through ACTIVE, so it can't express a hold that fails.
 */
async function tapMic() {
  await act(async () => {
    change(HOLD, State.UNDETERMINED, State.BEGAN);
    change(TAP, State.UNDETERMINED, State.BEGAN);
    change(HOLD, State.BEGAN, State.FAILED);
    change(TAP, State.BEGAN, State.ACTIVE);
    change(TAP, State.ACTIVE, State.END);
  });
}

async function press() {
  await act(async () => {
    change(HOLD, State.UNDETERMINED, State.BEGAN);
    change(TAP, State.UNDETERMINED, State.BEGAN);
    change(HOLD, State.BEGAN, State.ACTIVE);
    change(TAP, State.BEGAN, State.CANCELLED);
  });
}

async function letGo(translationX = 0) {
  await act(async () => {
    change(HOLD, State.ACTIVE, State.END, translationX);
  });
}

async function recogniserEnds() {
  const { useSpeechRecognitionEvent } = jest.requireMock('expo-speech-recognition');
  const handlers = useSpeechRecognitionEvent.mock.calls.filter(([name]: [string]) => name === 'end');
  await act(async () => handlers.at(-1)[1]());
}

beforeEach(() => jest.clearAllMocks());

describe('Moni chat mic', () => {
  it('a tap on a fresh page opens the listening capsule', async () => {
    render(<ChatScreen />);
    await tapMic();
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByText(CAPSULE)).toBeTruthy();
  });

  it('a tap still opens the capsule after an earlier hold', async () => {
    render(<ChatScreen />);
    await press();
    expect(start).toHaveBeenCalledTimes(1);
    await letGo();
    expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalledTimes(1);
    await recogniserEnds();

    await tapMic();
    expect(start).toHaveBeenCalledTimes(2);
    expect(screen.getByText(CAPSULE)).toBeTruthy();
  });

  it('a finger gone before the permission answer starts nothing', async () => {
    render(<ChatScreen />);
    await act(async () => {
      change(HOLD, State.UNDETERMINED, State.BEGAN);
      change(HOLD, State.BEGAN, State.ACTIVE);
      change(HOLD, State.ACTIVE, State.END);
    });
    expect(start).toHaveBeenCalledTimes(0);
  });

  it('letting go shows the composer, not the capsule, while the recogniser finishes', async () => {
    render(<ChatScreen />);
    await press();
    await letGo();
    expect(screen.queryByText(CAPSULE)).toBeNull();
  });
});
