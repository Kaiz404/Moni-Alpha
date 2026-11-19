'use client';

import { aiUseAllowed, currencySymbol, formatMoney, shiftMonth, suggestionMonths, turnOnFor, type FinanceCategory } from '@repo/core';
import type { BudgetQuestion, MinorAmount } from '@repo/types';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cat } from '@/components/brand';
import { ConsentDialog } from '@/components/chat/consent-dialog';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { changeAiConsent, currentAiConsent, webAiClient } from '@/lib/ai';
import { parseBudgetDraft } from '@/lib/budget-view';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';

/** What Moni is asked to suggest: the month's total, or one category's budget. */
export type SuggestTarget = { kind: 'total' } | { kind: 'category'; id: string; name: string };

type Step =
  | { kind: 'pick' }
  | { kind: 'consent'; target: SuggestTarget }
  | { kind: 'waiting'; target: SuggestTarget }
  | { kind: 'questions'; target: SuggestTarget; questions: BudgetQuestion[]; answers: string[] }
  | { kind: 'thinking'; target: SuggestTarget; questions: BudgetQuestion[]; answers: string[] }
  | { kind: 'suggestion'; target: SuggestTarget; amountMinor: MinorAmount; draft: string; note: string }
  | { kind: 'failed'; target: SuggestTarget };

const nameOf = (target: SuggestTarget) => (target.kind === 'total' ? 'Monthly total' : target.name);

/**
 * Ask Moni to suggest a budget (#80), the phone's `/budget/suggest` as a dialog: pick what for,
 * answer a few questions, then set the amount Moni suggests or a changed one.
 */
export function SuggestDialog({
  ledger,
  categories,
  onSet,
  onClose,
}: {
  ledger: Ledger;
  categories: readonly Pick<FinanceCategory, 'id' | 'name' | 'icon' | 'color'>[];
  onSet: (target: SuggestTarget, amountMinor: MinorAmount) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const { currency, calendar, now, transactions } = ledger;
  const month = calendar.monthKey(now);
  const monthsFor = (target: SuggestTarget) =>
    suggestionMonths(transactions, { month, currency, calendar }, target.kind === 'total' ? null : target.id);
  const request = (target: SuggestTarget, answers: { question: string; answer: string }[]) => ({
    category: target.kind === 'total' ? null : target.name,
    currency,
    months: monthsFor(target),
    answers,
    tone: moniStore().profilePreferences$.peek()?.moni_tone,
  });
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });

  const ask = async (target: SuggestTarget) => {
    if (!aiUseAllowed(await currentAiConsent(), 'chat')) {
      setStep({ kind: 'consent', target });
      return;
    }
    setStep({ kind: 'waiting', target });
    const result = await webAiClient('chat').suggestBudget(request(target, []));
    setStep(
      result.status === 'ok' && result.step === 'questions'
        ? { kind: 'questions', target, questions: result.questions, answers: result.questions.map(() => '') }
        : { kind: 'failed', target },
    );
  };
  const suggest = async (target: SuggestTarget, questions: BudgetQuestion[], answers: string[]) => {
    setStep({ kind: 'thinking', target, questions, answers });
    const result = await webAiClient('chat').suggestBudget(
      request(
        target,
        questions.map((question, index) => ({ question: question.text, answer: answers[index]!.trim() })),
      ),
    );
    setStep(
      result.status === 'ok' && result.step === 'suggestion'
        ? {
            kind: 'suggestion',
            target,
            amountMinor: result.amountMinor as MinorAmount,
            draft: String(result.amountMinor / 100),
            note: result.note,
          }
        : { kind: 'failed', target },
    );
  };

  if (step.kind === 'consent') {
    return (
      <ConsentDialog
        onTurnOn={() =>
          void currentAiConsent()
            .then((consent) => changeAiConsent(turnOnFor(consent, 'chat')))
            .then(() => ask(step.target))
            .catch(() => setStep({ kind: 'failed', target: step.target }))
        }
        onNotNow={onClose}
      />
    );
  }

  const average = (target: SuggestTarget) => {
    const months = monthsFor(target);
    if (!months.length) return null;
    const minor = months.reduce((sum, each) => sum + Number(each.spentMinor), 0) / months.length;
    return `You averaged ${whole(minor)} over ${months.length === 1 ? '1 month' : `${months.length} months`}`;
  };
  const typed = step.kind === 'suggestion' ? parseBudgetDraft(step.draft) : undefined;
  const targets: SuggestTarget[] = [
    { kind: 'total' },
    ...categories.map((category) => ({ kind: 'category' as const, id: category.id, name: category.name })),
  ];
  const lastMonth = (target: SuggestTarget) => {
    const last = monthsFor(target).at(-1);
    return last && last.month === shiftMonth(month, -1) ? last.spentMinor : 0;
  };

  return createPortal(
    <div
      className="scrim scrim-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="suggest-title" className="dialog motion-grow suggest-dialog" data-step={step.kind}>
        <div className="suggest-head">
          <Cat size={36} ground="ink" tile id="suggest-budget" />
          <h2 id="suggest-title" className="dialog-title">
            {step.kind === 'pick' ? 'Ask Moni to suggest a budget' : nameOf(step.target)}
          </h2>
          <span className="ai-tag">AI</span>
          <button type="button" className="icon-round icon-round-line press" aria-label="Close (Esc)" onClick={onClose} autoFocus={step.kind === 'pick'}>
            <Glyph name="close" size={20} />
          </button>
        </div>

        {step.kind === 'pick' && (
          <ul className="suggest-pick">
            {targets.map((target) => {
              const category = target.kind === 'category' ? categories.find((each) => each.id === target.id) : null;
              return (
                <li key={target.kind === 'total' ? 'total' : target.id}>
                  <button type="button" className="suggest-row press" data-target={target.kind === 'total' ? 'total' : target.id} onClick={() => void ask(target)}>
                    <Bubble icon={category ? category.icon : 'calendar-month-outline'} color={category?.color ?? null} size={32} glyph={16} />
                    <span className="inbox-text">
                      <b>{nameOf(target)}</b>
                      <span className="num">{whole(lastMonth(target))} last month</span>
                    </span>
                    <Glyph name="chevron-right" size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {(step.kind === 'waiting' || step.kind === 'thinking') && (
          <p className="meta suggest-wait" role="status">
            {step.kind === 'waiting' ? 'Moni is thinking of a few questions…' : 'Moni is working it out…'}
          </p>
        )}

        {step.kind === 'questions' && (
          <form
            className="suggest-questions"
            onSubmit={(event) => {
              event.preventDefault();
              if (step.answers.every((answer) => answer.trim())) void suggest(step.target, step.questions, step.answers);
            }}
          >
            {step.questions.map((question, index) => {
              const answer = (text: string) => setStep({ ...step, answers: step.answers.map((each, at) => (at === index ? text : each)) });
              return (
                <fieldset key={question.text} className="suggest-question">
                  <legend>{question.text}</legend>
                  <div className="suggest-chips">
                    {question.choices.map((choice) => (
                      <button key={choice} type="button" className="chip press" aria-pressed={step.answers[index] === choice} onClick={() => answer(choice)}>
                        {choice}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="Or type your own"
                    aria-label={`Your own answer to: ${question.text}`}
                    value={question.choices.includes(step.answers[index]!) ? '' : step.answers[index]}
                    onChange={(event) => answer(event.target.value)}
                  />
                </fieldset>
              );
            })}
            <div className="suggest-foot">
              <button type="submit" className="btn btn-ink press" disabled={step.answers.some((answer) => !answer.trim())}>
                Suggest a budget
              </button>
            </div>
          </form>
        )}

        {step.kind === 'suggestion' && (
          <form
            className="suggest-answer"
            onSubmit={(event) => {
              event.preventDefault();
              if (typed) onSet(step.target, typed);
            }}
          >
            <span className="caps">Moni suggests</span>
            <label className="suggest-amount">
              <span>{currencySymbol(currency)}</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Suggested budget a month, in whole units"
                value={step.draft}
                onChange={(event) => setStep({ ...step, draft: event.target.value })}
              />
              <span className="meta">a month</span>
            </label>
            {average(step.target) && <span className="meta num">{average(step.target)}</span>}
            <p className="suggest-note">{step.note}</p>
            <div className="suggest-foot">
              <button type="submit" className="btn btn-ink press" disabled={!typed}>
                Set budget
              </button>
            </div>
          </form>
        )}

        {step.kind === 'failed' && (
          <div className="suggest-answer">
            <p className="meta">Moni couldn&apos;t suggest one right now.</p>
            <div className="suggest-foot">
              <button type="button" className="btn btn-ink press" onClick={() => void ask(step.target)}>
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
