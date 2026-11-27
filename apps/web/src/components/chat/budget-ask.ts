'use client';

import {
  aiUseAllowed,
  budgetAnswers,
  budgetAverageLine,
  budgetReply,
  budgetRequestText,
  budgetTargets,
  PICK_TEXT,
  REPICK_TEXT,
  suggestionMonths,
  type BudgetAsk,
  type SuggestTarget,
} from '@repo/core';
import type { BudgetSuggestAnswer } from '@repo/types';
import { getShell, setShell } from '@/components/shell/shell-store';
import { currentAiConsent, webAiClient } from '@/lib/ai';
import { friendlyFailure, type ChatMessage } from '@/lib/chat-thread';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { append, replace } from './thread';

export type OpenBudgetStep = Extract<ChatMessage, { kind: 'budget_pick' | 'budget_question' }>;

/** The pick or question still waiting for the user: only while it is the thread's last message. */
export function openBudgetStep(chat: readonly ChatMessage[]): OpenBudgetStep | null {
  const last = chat.at(-1);
  return last?.kind === 'budget_pick' || last?.kind === 'budget_question' ? last : null;
}

async function suggest(target: SuggestTarget, answers: BudgetSuggestAnswer[], ledger: Ledger) {
  const { currency, calendar, now, transactions } = ledger;
  const months = suggestionMonths(
    transactions,
    { month: calendar.monthKey(now), currency, calendar },
    target.kind === 'total' ? null : target.id,
  );
  const result = await webAiClient('chat').suggestBudget({
    category: target.kind === 'total' ? null : target.name,
    currency,
    months,
    answers,
    tone: moniStore().profilePreferences$.peek()?.moni_tone,
  });
  return { result, average: budgetAverageLine(months, currency) };
}

function fail(id: string, reason: string) {
  console.warn('[chat] failed:', reason);
  replace(id, { role: 'moni', kind: 'text', text: friendlyFailure(reason), tone: 'error', analysis: false });
}

/**
 * Moni's questions about `target`, once chat may use AI; otherwise "Moni chat uses AI" waits on
 * `requestId`, the user's words that asked, and `turnOnAndAnswer` comes back here.
 */
export async function askBudgetQuestions(target: SuggestTarget, requestId: string, ledger: Ledger): Promise<void> {
  if (!aiUseAllowed(await currentAiConsent(), 'chat')) {
    setShell({ chatAsk: requestId });
    return;
  }
  const id = append({ role: 'moni', kind: 'thinking' });
  try {
    const { result } = await suggest(target, [], ledger);
    if (result.status !== 'ok') return fail(id, result.reason);
    if (result.step !== 'questions') return fail(id, 'budget questions');
    const [first] = result.questions;
    replace(id, {
      role: 'moni',
      kind: 'budget_question',
      text: first!.text,
      choices: first!.choices,
      ask: { target, questions: result.questions, answers: [] },
    });
  } catch (error) {
    fail(id, String(error));
  }
}

async function suggestAmount(ask: BudgetAsk, ledger: Ledger) {
  const id = append({ role: 'moni', kind: 'thinking' });
  try {
    const { result, average } = await suggest(ask.target, budgetAnswers(ask), ledger);
    if (result.status !== 'ok') return fail(id, result.reason);
    if (result.step !== 'suggestion') return fail(id, 'budget suggestion');
    replace(id, {
      role: 'moni',
      kind: 'budget_draft',
      target: ask.target,
      amountMinor: result.amountMinor,
      note: result.note,
      average,
      done: false,
    });
  } catch (error) {
    fail(id, String(error));
  }
}

/** Budget's "Ask Moni to suggest": the request goes in the thread, then Moni asks which budget. */
export function startBudgetAsk(target: SuggestTarget | null, ledger: Ledger): void {
  const text = budgetRequestText(target);
  if (target) {
    void askBudgetQuestions(target, append({ role: 'user', kind: 'text', text, budget: { target } }), ledger);
    return;
  }
  append({ role: 'user', kind: 'text', text });
  append({ role: 'moni', kind: 'budget_pick', text: PICK_TEXT, targets: budgetTargets(ledger.money.categories) });
}

/** The user's reply to the open pick or question, clicked or typed; the last answer gets the amount. */
export async function answerBudgetStep(step: OpenBudgetStep, text: string, ledger: Ledger): Promise<void> {
  const words = text.trim();
  if (!words) return;
  const reply = budgetReply(
    step.kind === 'budget_pick' ? { kind: 'pick', targets: step.targets } : { kind: 'question', ask: step.ask },
    words,
  );
  const requestId = append({
    role: 'user',
    kind: 'text',
    text: words,
    ...(reply.kind === 'ask' ? { budget: { target: reply.target } } : {}),
  });
  switch (reply.kind) {
    case 'ask':
      return askBudgetQuestions(reply.target, requestId, ledger);
    case 'repick':
      if (step.kind === 'budget_pick') append({ role: 'moni', kind: 'budget_pick', text: REPICK_TEXT, targets: step.targets });
      return;
    case 'next':
      append({ role: 'moni', kind: 'budget_question', text: reply.question.text, choices: reply.question.choices, ask: reply.ask });
      return;
    case 'suggest':
      return suggestAmount(reply.ask, ledger);
  }
}

/** The draft card's amount and Set budget's outcome live on its message. */
export function updateBudgetDraft(id: string, patch: { amountMinor?: number; done?: boolean }): void {
  setShell({
    chat: getShell().chat.map((message) => (message.id === id && message.kind === 'budget_draft' ? { ...message, ...patch } : message)),
  });
}
