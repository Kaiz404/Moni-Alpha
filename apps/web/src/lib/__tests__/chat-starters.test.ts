import { describe, expect, it } from 'vitest';
import { chatStarters } from '../chat-starters';

const titles = (view: Parameters<typeof chatStarters>[0]) => chatStarters(view).map((starter) => starter.title);

describe('the empty Moni chat starters follow the view', () => {
  it('offers to move ticked rows first, waiting for the category', () => {
    const [first] = chatStarters({ destination: 'activity', ticked: 3, category: null });
    expect(first).toEqual({ icon: 'check-all', title: 'Move the 3 ticked rows', words: 'Put these in ' });
    expect(titles({ destination: 'activity', ticked: 1, category: null })[0]).toBe('Move the ticked row');
  });

  it('asks about the one category in view, then the view itself', () => {
    expect(chatStarters({ destination: 'activity', ticked: 0, category: 'Food' })[0]).toEqual({
      icon: 'shape-outline',
      title: 'Ask about Food',
      words: 'How is my Food spending this month?',
    });
    expect(titles({ destination: 'budget', ticked: 0, category: null })).toEqual(['Ask about Budget', 'Ask Moni', 'Move rows']);
    expect(titles({ destination: 'activity', ticked: 0, category: null })).toEqual(['Ask about these rows', 'Ask Moni', 'Move rows']);
  });

  it('falls back to what Moni can do on a view it has no starter for', () => {
    expect(titles({ destination: 'home', ticked: 0, category: null })).toEqual(['Ask Moni', 'Move rows', 'What Moni can do']);
  });
});
