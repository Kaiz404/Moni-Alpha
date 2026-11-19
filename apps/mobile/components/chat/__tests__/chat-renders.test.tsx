import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ChatScreen from '@/app/chat';
import { appendMessage, deleteThread, type ChatMessage } from '@/lib/ai/chat/messages';
import { todayThreadDay } from '@/lib/ai/chat/sessions';

const bubbleTimes: string[] = [];
jest.mock('@/components/chat/chat-time', () => ({
  chatTime: (iso: string) => {
    bubbleTimes.push(iso);
    return '12:00 pm';
  },
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
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
jest.mock('@/lib/haptics', () => ({ holdCommit: jest.fn() }));
jest.mock('@/modules/moni-android-apps', () => ({
  __esModule: true,
  default: { setKeyboardPansWindowAsync: jest.fn() },
}));

const now = Date.now();
const said = (index: number): ChatMessage => ({
  id: `said-${index}`,
  role: 'user',
  kind: 'user_text',
  content: `coffee ${index}`,
  createdAt: new Date(now - (20 - index) * 1000).toISOString(),
});

/** Renders of thread bubbles, told apart from the header clock by their message times. */
function bubbleRenders(messages: ChatMessage[]): number {
  const times = new Set(messages.map((message) => message.createdAt));
  return bubbleTimes.filter((iso) => times.has(iso)).length;
}

describe('Moni chat rendering', () => {
  const day = todayThreadDay();
  const thread = Array.from({ length: 8 }, (_, index) => said(index));

  beforeEach(() => {
    deleteThread(day);
    thread.forEach((message) => appendMessage(message));
    bubbleTimes.length = 0;
  });
  afterAll(() => deleteThread(day));

  it('typing re-renders no bubble in the thread', () => {
    render(<ChatScreen />);
    expect(bubbleRenders(thread)).toBe(8);
    bubbleTimes.length = 0;

    for (const text of ['h', 'ho', 'how', 'how m', 'how much']) fireEvent.changeText(screen.getByTestId('chat.input'), text);

    expect(bubbleRenders(thread)).toBe(0);
  });

  it('a new message renders only its own bubble', () => {
    render(<ChatScreen />);
    bubbleTimes.length = 0;
    const next = said(9);

    act(() => {
      appendMessage(next);
    });

    expect(bubbleRenders(thread)).toBe(0);
    expect(bubbleRenders([next])).toBe(1);
  });
});
