import type { BudgetQuestion, BudgetSuggestAnswer, CurrencyCode, MinorAmount } from '@repo/types';

import { formatMoney } from '../glossary';

/** What Moni is asked to suggest: the month's total, or one category's budget. */
export type SuggestTarget = { kind: 'total' } | { kind: 'category'; id: string; name: string };

/** Moni sizing a budget in chat (#139): its questions, all asked at once, and the answers so far. */
export type BudgetAsk = {
  target: SuggestTarget;
  questions: BudgetQuestion[];
  answers: string[];
};

/** A budget step Moni waits on in the thread: which budget, or one of its questions. */
export type BudgetStep = { kind: 'pick'; targets: readonly SuggestTarget[] } | { kind: 'question'; ask: BudgetAsk };

/** What a reply to the open step leads to. */
export type BudgetReply =
  /** A budget was picked: Moni asks its questions about it. */
  | { kind: 'ask'; target: SuggestTarget }
  /** The typed pick named no budget: Moni asks again. */
  | { kind: 'repick' }
  /** More questions wait: Moni asks the next one. */
  | { kind: 'next'; ask: BudgetAsk; question: BudgetQuestion }
  /** Every question is answered: Moni works out the amount. */
  | { kind: 'suggest'; ask: BudgetAsk };

export const REPICK_TEXT = 'Pick one of these, and I will ask a few questions.';
export const PICK_TEXT = 'Which budget should I suggest?';

export function suggestTargetName(target: SuggestTarget): string {
  return target.kind === 'total' ? 'Monthly total' : target.name;
}

/** The words the user's request goes into the thread as. */
export function budgetRequestText(target: SuggestTarget | null): string {
  if (!target) return 'Suggest a budget';
  return target.kind === 'total' ? 'Suggest a monthly total' : `Suggest a budget for ${target.name}`;
}

/** The monthly total first, then each spending category. */
export function budgetTargets(categories: readonly { id: string; name: string }[]): SuggestTarget[] {
  return [{ kind: 'total' }, ...categories.map((category) => ({ kind: 'category' as const, id: category.id, name: category.name }))];
}

/** A tapped or typed reply: a pick matches a budget's name; any words answer a question. */
export function budgetReply(step: BudgetStep, answer: string): BudgetReply {
  const words = answer.trim();
  if (step.kind === 'pick') {
    const target = step.targets.find((each) => suggestTargetName(each).toLowerCase() === words.toLowerCase());
    return target ? { kind: 'ask', target } : { kind: 'repick' };
  }
  const ask: BudgetAsk = { ...step.ask, answers: [...step.ask.answers, words.slice(0, 200)] };
  const question = ask.questions[ask.answers.length];
  return question ? { kind: 'next', ask, question } : { kind: 'suggest', ask };
}

/** The answers as `POST /v1/budget/suggest` takes them, in the order asked. */
export function budgetAnswers(ask: BudgetAsk): BudgetSuggestAnswer[] {
  return ask.questions.flatMap((question, index) => {
    const answer = ask.answers[index];
    return answer ? [{ question: question.text, answer }] : [];
  });
}

/** "You averaged RM450 over 3 months" from the months the suggestion starts from, or null with none. */
export function budgetAverageLine(
  months: readonly { spentMinor: MinorAmount | number }[],
  currency: CurrencyCode,
): string | null {
  if (!months.length) return null;
  const average = months.reduce((sum, month) => sum + Number(month.spentMinor), 0) / months.length;
  return `You averaged ${formatMoney(average, currency, { whole: true })} over ${months.length === 1 ? '1 month' : `${months.length} months`}`;
}
