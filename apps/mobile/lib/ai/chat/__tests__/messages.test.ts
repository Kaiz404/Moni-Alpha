import {
  createNewSession,
  exportHistoryForApi,
  replaceSessionMessages,
  type ChatMessage,
} from '@/lib/ai/chat/messages';

const at = (hours: number, minutes: number) => new Date(2026, 9, 12, hours, minutes).toISOString();

function message(patch: Partial<ChatMessage> & Pick<ChatMessage, 'kind' | 'content'>): ChatMessage {
  return {
    id: `${patch.kind}-${patch.content}`,
    role: patch.kind.startsWith('user') ? 'user' : 'assistant',
    createdAt: at(9, 0),
    ...patch,
  };
}

describe('exportHistoryForApi', () => {
  beforeEach(() => createNewSession());

  it('sends only answered analysis turns, stamped with their local time', () => {
    replaceSessionMessages([
      message({ kind: 'user_text', content: 'lunch 12', createdAt: at(12, 5) }),
      message({
        kind: 'assistant_text',
        content: "Got it — I'll let you know when it's ready to review.",
        status: 'done',
      }),
      message({ kind: 'user_text', content: 'how much on food?', createdAt: at(12, 7) }),
      message({
        kind: 'assistant_text',
        content: 'You spent MYR 420 on food.',
        status: 'done',
        analysis: true,
        createdAt: at(12, 7),
      }),
      message({ kind: 'user_text', content: 'and transport?', createdAt: at(12, 9) }),
      message({
        kind: 'assistant_text',
        content: 'Analysis failed: llm: model returned invalid JSON',
        status: 'error',
      }),
    ]);

    expect(exportHistoryForApi()).toEqual([
      { role: 'user', content: '[12:07] how much on food?' },
      { role: 'assistant', content: '[12:07] You spent MYR 420 on food.' },
    ]);
  });

  it('pairs a clarified question with its eventual answer and keeps the last pairs', () => {
    const turns: ChatMessage[] = [];
    for (let i = 0; i < 8; i += 1) {
      turns.push(
        message({ kind: 'user_text', content: `q${i}`, createdAt: at(10, i) }),
        message({ kind: 'assistant_clarify', content: 'Log or ask?', status: 'done' }),
        message({
          kind: 'assistant_text',
          content: `a${i}`,
          status: 'done',
          analysis: true,
          createdAt: at(10, i),
        }),
      );
    }
    replaceSessionMessages(turns);

    const history = exportHistoryForApi(2);
    expect(history.map((h) => h.content)).toEqual([
      '[10:06] q6',
      '[10:06] a6',
      '[10:07] q7',
      '[10:07] a7',
    ]);
  });
});
