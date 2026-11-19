'use client';

import {
  aiUseAllowed,
  buildAnswerSnapshot,
  buildChatSnapshot,
  draftCategoryChange,
  draftIntro,
  notNow,
  pickViewAnswerCard,
  planTransactionsEdit,
  resolveRoute,
  turnOnFor,
  type DraftRow,
} from '@repo/core';
import { getShell, setShell } from '@/components/shell/shell-store';
import { activityItems, monthSoFar, rowsInView } from '@/lib/activity-items';
import type { ActivityQuery } from '@/lib/activity-query';
import { changeAiConsent, currentAiConsent, webAiClient } from '@/lib/ai';
import { friendlyFailure, historyForApi, type ChatMessage, type DraftState } from '@/lib/chat-thread';
import { commit, planContext } from '@/lib/ledger/commit';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';

/** What a question is asked from: the ledger as it is, and the view (Activity's query and ticks). */
export type AskFrom = {
  ledger: Ledger;
  /** Activity's query when the question comes from Activity, else null. */
  query: ActivityQuery | null;
  ticked: readonly string[];
  /** The one category the view shows, which a spending question without one is about. */
  viewCategoryId: string | null;
};

type MoniMessage = Extract<ChatMessage, { role: 'moni' }>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function append(message: DistributiveOmit<ChatMessage, 'id' | 'at'>): string {
  const id = newId();
  setShell((shell) => ({ chat: [...shell.chat, { ...message, id, at: now() } as ChatMessage] }));
  return id;
}

function replace(id: string, next: DistributiveOmit<MoniMessage, 'id' | 'at'>) {
  setShell((shell) => ({
    chat: shell.chat.map((message) => (message.id === id ? ({ ...next, id, at: now() } as ChatMessage) : message)),
  }));
}

function questionText(id: string): string | null {
  const message = getShell().chat.find((each) => each.id === id);
  return message?.role === 'user' ? message.text : null;
}

/** The main currency's rows as the draft reads them, newest first. */
function draftRows(ledger: Ledger): DraftRow[] {
  return ledger.transactions
    .filter((transaction) => transaction.currency === ledger.currency)
    .map((transaction) => ({
      id: transaction.id,
      merchant: transaction.merchant,
      categoryId: transaction.categoryId,
      amountMinor: Number(transaction.amountMinor),
      day: ledger.calendar.dayKey(transaction.transactionDate),
      type: transaction.type,
      analysisExcluded: transaction.analysisExcluded,
      debtActivityId: transaction.debtActivityId,
    }));
}

function categoriesOf(ledger: Ledger) {
  return Object.values(ledger.projection.categoriesById)
    .filter((category) => category.isActive && (category.userId === null || category.userId === ledger.userId) && category.type !== 'income')
    .map((category) => ({ id: category.id, name: category.name }));
}

/**
 * One message from the composer. A request to move rows becomes a draft from the ledger (nothing is
 * sent); a spend points to Add; a question asks Moni's AI, once the user has let chat use it.
 */
export async function ask(text: string, from: AskFrom): Promise<void> {
  const question = text.trim();
  if (!question) return;
  const id = append({ role: 'user', kind: 'text', text: question });

  const history = draftRows(from.ledger);
  const inView = new Set(
    rowsInView(activityItems(from.ledger), from.query, from.ticked, monthSoFar(from.ledger)).map((item) => item.id),
  );
  const draft = draftCategoryChange({
    text: question,
    rows: history.filter((row) => inView.has(row.id)),
    history,
    categories: categoriesOf(from.ledger),
    aliases: from.ledger.aliases,
  });
  if (draft) {
    append({ role: 'moni', kind: 'draft', intro: draftIntro(draft), draft, state: { phase: 'open' } });
    return;
  }
  if (resolveRoute(question, false) === 'extract') {
    append({ role: 'moni', kind: 'add', text: question });
    return;
  }
  if (!aiUseAllowed(await currentAiConsent(), 'chat')) {
    setShell({ chatAsk: id });
    return;
  }
  await answer(question, from);
}

/** "Turn on AI" in "Moni chat uses AI": records the choice, then answers the question that waited. */
export async function turnOnAndAnswer(from: AskFrom): Promise<void> {
  const waiting = getShell().chatAsk;
  setShell({ chatAsk: null });
  try {
    await changeAiConsent(turnOnFor(await currentAiConsent(), 'chat'));
  } catch {
    append({ role: 'moni', kind: 'text', text: "Moni couldn't save your choice. Try again.", tone: 'error', analysis: false });
    return;
  }
  const question = waiting && questionText(waiting);
  if (question) await answer(question, from);
}

/** "Not now", or closing the dialog: recorded the first time, and the question stays unanswered. */
export async function notNowForChat(): Promise<void> {
  setShell({ chatAsk: null });
  append({ role: 'moni', kind: 'text', text: friendlyFailure('consent'), tone: 'error', analysis: false });
  await changeAiConsent(notNow(await currentAiConsent())).catch(() => {});
}

/** The phone's `answer`: the card's numbers come from the ledger; the model's reply is its caption. */
async function answer(question: string, { ledger, viewCategoryId }: AskFrom): Promise<void> {
  const id = append({ role: 'moni', kind: 'thinking' });
  try {
    const at = new Date();
    const card = pickViewAnswerCard(
      question,
      buildAnswerSnapshot({
        ...ledger.moneyRows,
        currency: ledger.currency,
        waiting: ledger.waiting.map((proposal) => proposal.id),
        walletsById: ledger.projection.walletsById,
        now: at,
        calendar: ledger.calendar,
      }),
      viewCategoryId,
    );
    if (card?.kind === 'captures') return replace(id, { role: 'moni', kind: 'card', card, caption: '', analysis: false });
    const result = await webAiClient('chat').analyzeFinances({
      message: question,
      snapshot: buildChatSnapshot({
        projection: ledger.projection,
        userId: ledger.userId,
        overrides: ledger.moneyRows.overrides,
        message: question,
        now: at,
        calendar: ledger.calendar,
      }),
      history: historyForApi(getShell().chat, at),
      tone: moniStore().profilePreferences$.peek()?.moni_tone,
    });
    const reply = result.status === 'ok' ? result.reply : null;
    if (card) return replace(id, { role: 'moni', kind: 'card', card, caption: reply ?? '', analysis: reply !== null });
    if (reply !== null) return replace(id, { role: 'moni', kind: 'text', text: reply, tone: 'done', analysis: true });
    console.warn('[chat] failed:', result.status === 'ok' ? '' : result.reason);
    replace(id, { role: 'moni', kind: 'text', text: friendlyFailure(result.status === 'ok' ? '' : result.reason), tone: 'error', analysis: false });
  } catch (error) {
    console.warn('[chat] failed:', error);
    replace(id, { role: 'moni', kind: 'text', text: friendlyFailure(String(error)), tone: 'error', analysis: false });
  }
}

function setDraft(id: string, state: DraftState) {
  setShell((shell) => ({
    chat: shell.chat.map((message) => (message.id === id && message.kind === 'draft' ? { ...message, state } : message)),
  }));
}

/** Approve: one write plan for every row, with the toast's Undo and Ctrl Z; undoing reopens the draft. */
export function approveDraft(id: string, ledger: Ledger): void {
  const message = getShell().chat.find((each) => each.id === id);
  if (message?.kind !== 'draft' || message.state.phase !== 'open') return;
  const { rows, to } = message.draft;
  const done = commit(
    planTransactionsEdit(
      rows.map((row) => row.id),
      { categoryId: to.id },
      ledger.projection,
      planContext(ledger.userId),
    ),
    `Changed ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} to ${to.name}`,
    undefined,
    () => setDraft(id, { phase: 'open' }),
  );
  if (done) setDraft(id, { phase: 'done', undo: done.undo });
}

export function keepDraft(id: string): void {
  setDraft(id, { phase: 'kept' });
}
