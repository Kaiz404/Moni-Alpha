import { foldedOnReopen } from '@/components/chat/thread-fold';
import type { ChatMessage } from '@/lib/ai/chat/messages';

const at = (hour: number, minute = 0) => new Date(2026, 9, 14, hour, minute).toISOString();

const talk: ChatMessage[] = [
  { id: 'u1', role: 'user', kind: 'user_text', content: 'How much can I spend today?', createdAt: at(9, 12) },
  {
    id: 'a1',
    role: 'assistant',
    kind: 'assistant_text',
    content: 'You can spend RM24 a day.',
    status: 'done',
    createdAt: at(9, 12),
  },
];

describe('foldedOnReopen', () => {
  it('folds the whole thread after two idle hours', () => {
    expect(foldedOnReopen(talk, new Set(), new Date(2026, 9, 14, 11, 12))).toBe(2);
  });

  it('keeps the thread open inside two hours', () => {
    expect(foldedOnReopen(talk, new Set(), new Date(2026, 9, 14, 11, 11))).toBe(0);
  });

  it('never folds while a draft waits for a decision', () => {
    const waiting: ChatMessage[] = [
      ...talk,
      { id: 'd1', role: 'assistant', kind: 'assistant_draft', proposalId: 'p1', createdAt: at(9, 13) },
    ];
    expect(foldedOnReopen(waiting, new Set(['p1']), new Date(2026, 9, 14, 14))).toBe(0);
    expect(foldedOnReopen(waiting, new Set(), new Date(2026, 9, 14, 14))).toBe(3);
  });

  it('never folds while Moni is still replying', () => {
    const replying: ChatMessage[] = [
      ...talk,
      { id: 's1', role: 'assistant', kind: 'assistant_status', content: 'Thinking', createdAt: at(9, 13) },
    ];
    expect(foldedOnReopen(replying, new Set(), new Date(2026, 9, 14, 14))).toBe(0);
  });

  it('has nothing to fold in an empty thread', () => {
    expect(foldedOnReopen([], new Set(), new Date(2026, 9, 14, 14))).toBe(0);
  });
});
