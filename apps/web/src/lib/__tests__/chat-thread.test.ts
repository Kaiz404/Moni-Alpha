import { describe, expect, it } from 'vitest';
import { friendlyFailure, historyForApi, lookingAt, type ChatMessage } from '../chat-thread';

const at = (hour: number, minute: number, day = 14) => new Date(2026, 9, day, hour, minute).toISOString();

describe('historyForApi', () => {
  it('sends today\'s answered pairs with their local times, never drafts, errors or bare cards', () => {
    const thread: ChatMessage[] = [
      { id: 'y1', at: at(20, 0, 13), role: 'user', kind: 'text', text: 'yesterday?' },
      { id: 'y2', at: at(20, 1, 13), role: 'moni', kind: 'text', text: 'Yesterday.', tone: 'done', analysis: true },
      { id: 'u1', at: at(9, 5), role: 'user', kind: 'text', text: 'Why is Food so high?' },
      { id: 'm1', at: at(9, 6), role: 'moni', kind: 'card', card: { kind: 'captures', proposalIds: [] }, caption: 'Grab is most of it.', analysis: true },
      { id: 'u2', at: at(9, 7), role: 'user', kind: 'text', text: 'Move my Grab rides out of Food' },
      {
        id: 'm2',
        at: at(9, 7),
        role: 'moni',
        kind: 'draft',
        intro: 'I found 3 rows.',
        draft: { from: null, to: { id: 't', name: 'Transport' }, alreadyThere: null, rows: [], totalMinor: 0 },
        state: { phase: 'open' },
      },
      { id: 'u3', at: at(9, 8), role: 'user', kind: 'text', text: 'and bills?' },
      { id: 'm3', at: at(9, 9), role: 'moni', kind: 'text', text: "Moni can't answer right now.", tone: 'error', analysis: false },
      { id: 'u4', at: at(9, 10), role: 'user', kind: 'text', text: 'what is left?' },
      { id: 'm4', at: at(9, 11), role: 'moni', kind: 'card', card: { kind: 'captures', proposalIds: [] }, caption: '', analysis: false },
      { id: 'u5', at: at(9, 12), role: 'user', kind: 'text', text: 'Netflix?' },
      { id: 'm5', at: at(9, 13), role: 'moni', kind: 'text', text: 'Netflix is covered.', tone: 'done', analysis: true },
    ];
    expect(historyForApi(thread, new Date(2026, 9, 14, 12, 0))).toEqual([
      { role: 'user', content: '[09:05] Why is Food so high?' },
      { role: 'assistant', content: '[09:06] Grab is most of it.' },
      { role: 'user', content: '[09:12] Netflix?' },
      { role: 'assistant', content: '[09:13] Netflix is covered.' },
    ]);
    expect(historyForApi(thread, new Date(2026, 9, 14, 12, 0), 1)).toEqual([
      { role: 'user', content: '[09:12] Netflix?' },
      { role: 'assistant', content: '[09:13] Netflix is covered.' },
    ]);
  });
});

describe('lookingAt', () => {
  const names = {
    category: (id: string) => ({ food: 'Food & Dining', transport: 'Transport', bills: 'Bills' })[id],
    row: (id: string) => ({ r1: 'GRAB*FOOD' })[id],
  };
  const look = (path: string, query = '', ticked = 0) => lookingAt(path, new URLSearchParams(query), ticked, names);

  it('names each section, and Activity with what its URL and ticks say', () => {
    expect(look('/home')).toBe('Home');
    expect(look('/budget', 'category=food')).toBe('Budget');
    expect(look('/settings/delete-account')).toBe('Settings');
    expect(look('/activity')).toBe('Activity');
    expect(look('/activity', 'categories=food&pane=chat')).toBe('Activity, Food & Dining');
    expect(look('/activity', 'view=check&categories=food,transport&from=2026-10-01&to=2026-10-14', 3)).toBe(
      'Activity, To check, Food & Dining and Transport, 1–14 Oct, 3 ticked rows',
    );
    expect(look('/activity', 'categories=food,transport,bills&from=2026-09-28&q=grab', 1)).toBe(
      'Activity, 3 categories, from 28 Sep, “grab”, 1 ticked row',
    );
    expect(look('/activity/r1', 'categories=food')).toBe('Activity, GRAB*FOOD');
  });
});

describe('friendlyFailure', () => {
  it('turns a gateway reason into the words the thread shows', () => {
    expect(friendlyFailure('consent')).toBe("Moni's AI is off for chat. Turn it on in Settings › Moni's AI.");
    expect(friendlyFailure('Failed to fetch')).toBe("Moni can't answer right now. Check your connection and try again.");
    expect(friendlyFailure('rate limit exceeded')).toBe('Moni is busy right now. Try again in a minute.');
    expect(friendlyFailure('invalid or expired token')).toBe('Sign in again, then try once more.');
    expect(friendlyFailure('chat analysis failed')).toBe("Moni couldn't answer that. Try asking another way.");
  });
});
