import { render, screen } from '@testing-library/react-native';

import ChatHistoryScreen from '@/app/chat/history';
import { appendMessage } from '@/lib/ai/chat/messages';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('Past days', () => {
  it('lists a day with its message count, the latest words and an open draft pill', () => {
    const day = new Date(2026, 9, 13, 9, 0);
    appendMessage({
      id: 'u1',
      role: 'user',
      kind: 'user_text',
      content: 'Is Netflix covered?',
      createdAt: day.toISOString(),
    });
    appendMessage({
      id: 'd1',
      role: 'assistant',
      kind: 'assistant_draft',
      proposalId: 'gone',
      createdAt: new Date(2026, 9, 13, 9, 1).toISOString(),
    });
    render(<ChatHistoryScreen />);
    expect(screen.getByText('2 messages')).toBeTruthy();
    expect(screen.getByText('1 draft')).toBeTruthy();
    expect(screen.getByText('· Is Netflix covered?')).toBeTruthy();
  });
});
