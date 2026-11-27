import type { Destination } from './nav';

export type ChatStarter = { icon: string; title: string; words: string };

/** What the docked chat can see: the view, Activity's ticked rows, and the one category in view. */
export type StarterView = { destination: Destination | null; ticked: number; category: string | null };

const ASK: ChatStarter = { icon: 'chat-question-outline', title: 'Ask Moni', words: 'Where did my money go this month?' };
const MOVE: ChatStarter = { icon: 'swap-horizontal', title: 'Move rows', words: 'Move my Grab rides to Transport' };

/**
 * The empty chat's three starters (#151), led by one about the view beside it, so the first open
 * shows that Moni reads what the user is looking at. Each fills the box and waits for Enter.
 */
export function chatStarters({ destination, ticked, category }: StarterView): ChatStarter[] {
  if (destination === 'activity' && ticked > 0)
    return [
      { icon: 'check-all', title: `Move the ${ticked === 1 ? 'ticked row' : `${ticked} ticked rows`}`, words: 'Put these in ' },
      ASK,
      { icon: 'chat-question-outline', title: 'What Moni can do', words: 'What can you do?' },
    ];
  const lead: ChatStarter | null = category
    ? { icon: 'shape-outline', title: `Ask about ${category}`, words: `How is my ${category} spending this month?` }
    : destination === 'budget'
      ? { icon: 'calendar-blank', title: 'Ask about Budget', words: 'Am I on track this month?' }
      : destination === 'activity'
        ? { icon: 'magnify', title: 'Ask about these rows', words: 'What did I spend the most on?' }
        : null;
  return lead ? [lead, ASK, MOVE] : [ASK, MOVE, { icon: 'chat-question-outline', title: 'What Moni can do', words: 'What can you do?' }];
}
