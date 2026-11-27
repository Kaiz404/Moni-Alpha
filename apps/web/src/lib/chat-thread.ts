import {
  AI_CONSENT_REASON,
  dayOfMonth,
  monthShort,
  monthOf,
  type AnswerCard,
  type BudgetAsk,
  type CategoryDraft,
  type SuggestTarget,
} from '@repo/core';
import type { ChatHistoryMessage } from '@repo/types';
import { parseActivityQuery } from './activity-query';
import { destinationOf, navItem } from './nav';

/**
 * Moni chat's thread on the web: one per tab, held in the shell store so a resize or a section change
 * keeps it. A draft moves from open to done (with the Undo that puts the rows back) or kept.
 */
export type DraftState = { phase: 'open' } | { phase: 'done'; undo: () => void } | { phase: 'kept' };

type Base = { id: string; at: string };

export type ChatMessage = Base &
  (
    /** `budget` marks a request for Moni's budget questions, which the consent dialog resumes. */
    | { role: 'user'; kind: 'text'; text: string; budget?: { target: SuggestTarget } }
    | { role: 'moni'; kind: 'thinking' }
    /** `analysis` marks a reply from the gateway: the only Moni turns sent back as history. */
    | { role: 'moni'; kind: 'text'; text: string; tone: 'done' | 'error'; analysis: boolean }
    /** The card's numbers come from the ledger; `caption` is the model's reply, empty when it had none. */
    | { role: 'moni'; kind: 'card'; card: AnswerCard; caption: string; analysis: boolean }
    | { role: 'moni'; kind: 'draft'; intro: string; draft: CategoryDraft; state: DraftState }
    /** Adding a spend from chat makes a capture on the phone; the web points to Add with the words. */
    | { role: 'moni'; kind: 'add'; text: string }
    /** Suggest a budget (#139): which budget, then Moni's questions one at a time, then the amount. */
    | { role: 'moni'; kind: 'budget_pick'; text: string; targets: SuggestTarget[] }
    | { role: 'moni'; kind: 'budget_question'; text: string; choices: string[]; ask: BudgetAsk }
    | {
        role: 'moni';
        kind: 'budget_draft';
        target: SuggestTarget;
        amountMinor: number;
        note: string;
        average: string | null;
        done: boolean;
      }
  );

const pad = (n: number) => String(n).padStart(2, '0');

function localDay(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * The phone's history (`exportHistoryForApi`): the last `maxPairs` question and answer pairs of today
 * whose answer came from the gateway, each with its local `[HH:MM]`. Drafts, errors and cards without
 * a caption never reach the model.
 */
export function historyForApi(messages: readonly ChatMessage[], now: Date, maxPairs = 6): ChatHistoryMessage[] {
  const today = localDay(now);
  const stamp = (iso: string) => {
    const at = new Date(iso);
    return `[${pad(at.getHours())}:${pad(at.getMinutes())}] `;
  };
  const history: ChatHistoryMessage[] = [];
  let question: Extract<ChatMessage, { role: 'user' }> | null = null;
  for (const message of messages) {
    if (localDay(new Date(message.at)) !== today) continue;
    if (message.role === 'user') {
      question = message;
      continue;
    }
    const reply =
      message.kind === 'text' && message.analysis && message.tone === 'done'
        ? message.text
        : message.kind === 'card' && message.analysis && message.caption
          ? message.caption
          : null;
    if (reply !== null && question) {
      history.push({ role: 'user', content: stamp(question.at) + question.text }, { role: 'assistant', content: stamp(message.at) + reply });
      question = null;
    }
  }
  return history.slice(-maxPairs * 2);
}

/** The thread only shows these; the gateway's reason stays in the console (the phone's `friendlyFailure`). */
export function friendlyFailure(reason: string): string {
  if (reason === 'no AI gateway') return "Moni can't answer on this site yet. You can still add spends with Add.";
  if (reason === AI_CONSENT_REASON) return "Moni's AI is off for chat. Turn it on in Settings › Moni's AI.";
  if (/network request failed|failed to fetch|timed? ?out|keys are not loaded|backend error \(5\d\d\)/i.test(reason))
    return "Moni can't answer right now. Check your connection and try again.";
  if (/rate limit|too many/i.test(reason)) return 'Moni is busy right now. Try again in a minute.';
  if (/not authenticated|invalid or expired token|missing bearer/i.test(reason)) return 'Sign in again, then try once more.';
  return "Moni couldn't answer that. Try asking another way.";
}

export type ViewNames = {
  category: (id: string) => string | undefined;
  row: (id: string) => string | undefined;
};

function span(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  const label = (day: string) => `${dayOfMonth(day)} ${monthShort(monthOf(day))}`;
  if (from && to) {
    if (from === to) return label(from);
    return monthOf(from) === monthOf(to) ? `${dayOfMonth(from)}–${label(to)}` : `${label(from)} to ${label(to)}`;
  }
  return from ? `from ${label(from)}` : `to ${label(to!)}`;
}

/**
 * "Looking at …" in Moni chat's header: the section, and on Activity what the URL and the ticks say
 * (the open row, the built-in view, categories, dates, a search, ticked rows).
 */
export function lookingAt(pathname: string, params: URLSearchParams, ticked: number, names: ViewNames): string {
  const where = destinationOf(pathname);
  if (!where) return 'Moni';
  const section = navItem(where).label;
  if (where !== 'activity') return section;
  const open = /^\/activity\/([^/]+)$/.exec(pathname)?.[1];
  const openName = open && names.row(decodeURIComponent(open));
  if (openName) return `${section}, ${openName}`;
  const query = parseActivityQuery(params);
  const categories = query.categories.map(names.category).filter((name): name is string => Boolean(name));
  const parts = [
    query.saved === 'check' ? 'To check' : query.saved === 'auto' ? 'Auto' : null,
    categories.length > 2 ? `${categories.length} categories` : categories.join(' and ') || null,
    span(query.from, query.to),
    query.q ? `“${query.q}”` : null,
    ticked ? `${ticked} ticked ${ticked === 1 ? 'row' : 'rows'}` : null,
  ].filter(Boolean);
  return [section, ...parts].join(', ');
}
