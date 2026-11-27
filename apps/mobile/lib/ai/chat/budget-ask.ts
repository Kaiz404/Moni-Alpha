import type { BudgetSuggestAnswer } from '@repo/types';
import { randomUUID } from 'expo-crypto';

import { getAiClient } from '@/lib/ai/client';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { selectMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { debtsWithBalance$, transactions$ } from '@/lib/finance/selectors';
import { profilePreferences$ } from '@/lib/store';
import { getUserId } from '@/lib/supabase/client';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';
import {
  budgetAnswers,
  budgetAverageLine,
  budgetReply,
  budgetRequestText,
  budgetTargets,
  moneyLedger,
  PICK_TEXT,
  REPICK_TEXT,
  suggestionMonths,
  type BudgetAsk,
  type SuggestTarget,
} from '@repo/core';

import { appendMessage, type BudgetInto, type ChatMessage } from './messages';
import { startTurn } from './turn';

export type OpenBudgetStep = Extract<ChatMessage, { kind: 'assistant_budget_pick' | 'assistant_budget_question' }>;

/** The pick or question still waiting for the user: only while it is the thread's last message. */
export function openBudgetStep(messages: readonly ChatMessage[]): OpenBudgetStep | null {
  const last = messages.at(-1);
  return last?.kind === 'assistant_budget_pick' || last?.kind === 'assistant_budget_question' ? last : null;
}

function say(content: string) {
  appendMessage({ id: randomUUID(), role: 'user', kind: 'user_text', content, createdAt: new Date().toISOString() });
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function moniAsks(step: DistributiveOmit<OpenBudgetStep, 'id' | 'createdAt'>) {
  appendMessage({ ...step, id: randomUUID(), createdAt: new Date().toISOString() } as OpenBudgetStep);
}

/** The ledger as it stands, in the main currency: what Moni starts its suggestion from. */
async function ledgerNow() {
  const userId = await getUserId();
  const preferences = profilePreferences$.peek();
  const projection = financeProjection$.peek();
  const now = new Date();
  const ledger = moneyLedger(
    {
      userId,
      transactions: userId ? transactions$({ userId }).peek() : [],
      categoriesById: projection.categoriesById,
      budgetsById: projection.budgetsById,
      monthlyBudget: preferences?.monthly_budget ?? null,
      overrides: userId ? listRecurringOverrides(userId) : [],
      debts: userId ? debtsWithBalance$(userId).peek() : [],
    },
    now,
    deviceCalendar,
  );
  return { ledger, currency: selectMainCurrency(preferences), month: deviceCalendar.monthKey(now) };
}

async function suggest(target: SuggestTarget, answers: BudgetSuggestAnswer[]) {
  const { ledger, currency, month } = await ledgerNow();
  const months = suggestionMonths(
    ledger.transactions,
    { month, currency, calendar: deviceCalendar },
    target.kind === 'total' ? null : target.id,
  );
  const result = await getAiClient('chat').suggestBudget({
    category: target.kind === 'total' ? null : target.name,
    currency,
    months,
    answers,
    tone: profilePreferences$.peek()?.moni_tone,
  });
  return { result, average: budgetAverageLine(months, currency) };
}

async function askQuestions(target: SuggestTarget, into: BudgetInto) {
  const turn = startTurn('Thinking of a few questions');
  try {
    const { result } = await suggest(target, []);
    if (result.status !== 'ok') return turn.fail(result.reason);
    if (result.step !== 'questions') return turn.fail('budget questions');
    const [first] = result.questions;
    turn.finish({
      role: 'assistant',
      kind: 'assistant_budget_question',
      content: first!.text,
      choices: first!.choices,
      ask: { target, questions: result.questions, answers: [] },
      into,
    });
  } catch (error) {
    turn.fail(error instanceof Error ? error.message : String(error));
  }
}

async function suggestAmount(ask: BudgetAsk, into: BudgetInto) {
  const turn = startTurn('Working out a budget');
  try {
    const { result, average } = await suggest(ask.target, budgetAnswers(ask));
    if (result.status !== 'ok') return turn.fail(result.reason);
    if (result.step !== 'suggestion') return turn.fail('budget suggestion');
    turn.finish({
      role: 'assistant',
      kind: 'assistant_budget_draft',
      target: ask.target,
      into,
      amountMinor: result.amountMinor,
      note: result.note,
      average,
    });
  } catch (error) {
    turn.fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * "Suggest a budget" from Budget: the request goes in today's thread as the user's words, then Moni
 * asks which budget (with no target) or its questions.
 */
export async function startBudgetAsk(target: SuggestTarget | null, into: BudgetInto): Promise<void> {
  say(budgetRequestText(target));
  if (target) return askQuestions(target, into);
  const { ledger } = await ledgerNow();
  moniAsks({ role: 'assistant', kind: 'assistant_budget_pick', content: PICK_TEXT, targets: budgetTargets(ledger.categories), into });
}

/** The user's reply to the open pick or question, tapped or typed; the last answer gets the amount. */
export async function answerBudgetStep(step: OpenBudgetStep, text: string): Promise<void> {
  if (!text.trim()) return;
  say(text.trim());
  const reply = budgetReply(
    step.kind === 'assistant_budget_pick' ? { kind: 'pick', targets: step.targets } : { kind: 'question', ask: step.ask },
    text,
  );
  switch (reply.kind) {
    case 'ask':
      return askQuestions(reply.target, step.into);
    case 'repick':
      return moniAsks({ ...step, content: REPICK_TEXT });
    case 'next':
      return moniAsks({
        role: 'assistant',
        kind: 'assistant_budget_question',
        content: reply.question.text,
        choices: reply.question.choices,
        ask: reply.ask,
        into: step.into,
      });
    case 'suggest':
      return suggestAmount(reply.ask, step.into);
  }
}
