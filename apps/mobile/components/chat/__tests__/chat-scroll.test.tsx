import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';

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
jest.mock('@/lib/supabase/proposed-transactions', () => ({ isAwaitingReview: () => false }));
jest.mock('@/lib/haptics', () => ({ holdCommit: jest.fn() }));
jest.mock('@/modules/moni-android-apps', () => ({
  __esModule: true,
  default: { setKeyboardPansWindowAsync: jest.fn() },
}));

describe('Moni chat thread', () => {
  it('scrolls by the measured content height, so the newest card clears the composer', () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    render(<ChatScreen />);
    const list = screen.UNSAFE_getByType(FlatList);

    act(() => {
      fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 400 } } });
      fireEvent(list, 'contentSizeChange', 390, 1500);
    });
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 1100, animated: true });

    act(() => {
      fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } } });
    });
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 800, animated: false });
  });
});
