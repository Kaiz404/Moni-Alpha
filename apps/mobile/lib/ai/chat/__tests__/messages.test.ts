import {
  appendMessage,
  deleteThread,
  exportHistoryForApi,
  type ChatMessage,
} from '@/lib/ai/chat/messages';
import { threadDay } from '@/lib/ai/chat/sessions';

const at = (hours: number, minutes: number) => new Date(2026, 9, 12, hours, minutes).toISOString();
const NOW = new Date(2026, 9, 12, 18, 0);

const user = (content: string, createdAt: string): ChatMessage => ({
  id: `u-${content}`,
  role: 'user',
  kind: 'user_text',
  content,
  createdAt,
});

const reply = (
  content: string,
  createdAt: string,
  patch: { status?: 'done' | 'error'; analysis?: boolean } = {},
): ChatMessage => ({
  id: `a-${content}`,
  role: 'assistant',
  kind: 'assistant_text',
  content,
  createdAt,
  status: patch.status ?? 'done',
  analysis: patch.analysis,
});

describe('exportHistoryForApi', () => {
  beforeEach(() => deleteThread(threadDay(NOW)));

  it('sends only answered analysis turns and captioned cards, stamped with their local time', () => {
    [
      user('lunch 12', at(12, 5)),
      {
        id: 'draft',
        role: 'assistant',
        kind: 'assistant_draft',
        proposalId: 'p1',
        createdAt: at(12, 5),
      } satisfies ChatMessage,
      user('how much on food?', at(12, 7)),
      reply('You spent RM420 on food.', at(12, 7), { analysis: true }),
      user('and transport?', at(12, 9)),
      {
        id: 'card',
        role: 'assistant',
        kind: 'assistant_card',
        card: { kind: 'category_spend', categoryId: 'transport', spent: 14000, budget: 12000 },
        content: 'Two Shell fill-ups made up most of it.',
        analysis: true,
        createdAt: at(12, 9),
      } satisfies ChatMessage,
      user('and bills?', at(12, 11)),
      reply("I couldn't reach Moni's AI.", at(12, 11), { status: 'error' }),
    ].forEach(appendMessage);

    expect(exportHistoryForApi(6, NOW)).toEqual([
      { role: 'user', content: '[12:07] how much on food?' },
      { role: 'assistant', content: '[12:07] You spent RM420 on food.' },
      { role: 'user', content: '[12:09] and transport?' },
      { role: 'assistant', content: '[12:09] Two Shell fill-ups made up most of it.' },
    ]);
  });

  it('keeps only the last pairs', () => {
    for (let i = 0; i < 8; i += 1) {
      appendMessage(user(`q${i}`, at(10, i)));
      appendMessage(reply(`a${i}`, at(10, i), { analysis: true }));
    }
    expect(exportHistoryForApi(2, NOW).map((h) => h.content)).toEqual([
      '[10:06] q6',
      '[10:06] a6',
      '[10:07] q7',
      '[10:07] a7',
    ]);
  });
});
