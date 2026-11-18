import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ChatScreen from '@/app/chat';
import { appendMessage, deleteThread, listThreads } from '@/lib/ai/chat/messages';
import { sendChatMessage } from '@/lib/ai/chat/orchestrator';

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
let mockMetadata: Record<string, string> = {};
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1', user_metadata: mockMetadata } }),
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
jest.mock('@/lib/haptics', () => ({ holdCommit: jest.fn() }));
jest.mock('@/modules/moni-android-apps', () => ({
  __esModule: true,
  default: { setKeyboardPansWindowAsync: jest.fn() },
}));

beforeEach(() => {
  for (const thread of listThreads()) deleteThread(thread.day);
  mockMetadata = {};
  jest.mocked(sendChatMessage).mockReset().mockResolvedValue(undefined);
});

describe('Moni chat first open', () => {
  it('greets by first name and offers three starter cards', () => {
    mockMetadata = { display_name: 'Kai Zen' };
    render(<ChatScreen />);
    expect(screen.getByText('Hi Kai.')).toBeTruthy();
    expect(screen.getByText('What did you spend?')).toBeTruthy();
    expect(screen.getByTestId('chat.starter.0')).toHaveTextContent('Log a lunch12.50 at Mamak Ali');
    expect(screen.getByTestId('chat.starter.1')).toHaveTextContent('Set a budgetRM450 for food');
    expect(screen.getByTestId('chat.starter.2')).toHaveTextContent('Ask Moniwhat it can do');
  });

  it('says only Hi. when the profile has no name', () => {
    render(<ChatScreen />);
    expect(screen.getByText('Hi.')).toBeTruthy();
  });

  it.each([
    [0, 'lunch 12.50 at Mamak Ali'],
    [1, 'Set a RM450 food budget'],
    [2, 'What can you do?'],
  ])('starter %i puts %s in the composer without sending it', (index, text) => {
    render(<ChatScreen />);
    fireEvent.press(screen.getByTestId(`chat.starter.${index}`));
    expect(screen.getByTestId('chat.input').props.value).toBe(text);
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it('shows the cat once, in the greeting, until the thread starts', () => {
    render(<ChatScreen />);
    expect(screen.getAllByLabelText(/^Moni(, \w+)?$/)).toHaveLength(1);
    expect(screen.getByTestId('chat.blank.cat')).toBeTruthy();
    expect(screen.queryByTestId('chat.cat')).toBeNull();
    act(() => {
      appendMessage({
        id: 'u2',
        role: 'user',
        kind: 'user_text',
        content: 'coffee 9.00',
        createdAt: new Date().toISOString(),
      });
    });
    expect(screen.getByTestId('chat.cat')).toBeTruthy();
  });

  it('greets again on a new day after earlier days of chat', () => {
    appendMessage({
      id: 'y1',
      role: 'user',
      kind: 'user_text',
      content: 'coffee 9.00',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    render(<ChatScreen />);
    expect(screen.getByText('What did you spend?')).toBeTruthy();
    expect(screen.getByTestId('chat.starter.0')).toBeTruthy();
  });

  it('leaves once the thread has a message', () => {
    render(<ChatScreen />);
    act(() => {
      appendMessage({
        id: 'u1',
        role: 'user',
        kind: 'user_text',
        content: 'lunch 12.50 at Mamak Ali',
        createdAt: new Date().toISOString(),
      });
    });
    expect(screen.queryByText('What did you spend?')).toBeNull();
    expect(screen.queryByTestId('chat.starter.0')).toBeNull();
    expect(screen.getByText('lunch 12.50 at Mamak Ali')).toBeTruthy();
  });
});
