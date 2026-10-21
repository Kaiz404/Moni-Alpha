import {
  appendMessage,
  deleteThread,
  listThreads,
  readTodayThread,
  type ChatMessage,
} from '@/lib/ai/chat/messages';

jest.mock('@/lib/store', () => ({
  profilePreferences$: { peek: () => ({ finance_timezone: 'Asia/Kuala_Lumpur' }) },
}));

/** Kuala Lumpur is UTC+8 all year. */
const kl = (day: number, hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 9, day, hours - 8, minutes)).toISOString();

const say = (id: string, createdAt: string): ChatMessage => ({
  id,
  role: 'user',
  kind: 'user_text',
  content: id,
  createdAt,
});

describe('one thread per day', () => {
  beforeEach(() => {
    for (const thread of listThreads()) deleteThread(thread.day);
  });

  it('splits 23:59 and 00:01 local time into two threads', () => {
    appendMessage(say('late', kl(13, 23, 59)));
    appendMessage(say('early', kl(14, 0, 1)));
    expect(
      listThreads().map((thread) => [thread.day, thread.messages.map((m) => m.id)]),
    ).toEqual([
      ['2026-10-14', ['early']],
      ['2026-10-13', ['late']],
    ]);
  });

  it('keeps two messages 20 hours apart on one date in one thread, and reopens it today', () => {
    appendMessage(say('morning', kl(14, 2, 0)));
    appendMessage(say('night', kl(14, 22, 0)));
    expect(listThreads()).toHaveLength(1);
    expect(
      readTodayThread(new Date(kl(14, 23, 30))).messages.map((m) => m.id),
    ).toEqual(['morning', 'night']);
  });
});
