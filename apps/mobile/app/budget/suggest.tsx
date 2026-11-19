import type { BudgetQuestion, MinorAmount } from '@repo/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useBudgetData } from '@/components/budget/use-budget';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  InPlaceField,
  InPlaceGroup,
} from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getAiClient } from '@/lib/ai/client';
import { useAiGate } from '@/lib/ai/consent/use-ai-gate';
import {
  pickedSuggestion$,
  type SuggestTarget,
} from '@/lib/budget/suggestion';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { PLAN_LIMIT_MINOR } from '@/lib/finance/money';
import { profilePreferences$ } from '@/lib/store';
import {
  setMonthlyBudget,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import {
  currencySymbol,
  formatMoney,
  shiftMonth,
  spendByMonth,
  suggestionMonths,
} from '@repo/core';

type Step =
  | { kind: 'pick' }
  | { kind: 'idle'; target: SuggestTarget }
  | { kind: 'waiting'; target: SuggestTarget }
  | {
      kind: 'questions';
      target: SuggestTarget;
      questions: BudgetQuestion[];
      answers: string[];
    }
  | {
      kind: 'thinking';
      target: SuggestTarget;
      questions: BudgetQuestion[];
      answers: string[];
    }
  | {
      kind: 'suggestion';
      target: SuggestTarget;
      amountMinor: MinorAmount;
      note: string;
    }
  | { kind: 'failed'; target: SuggestTarget };

const nameOf = (target: SuggestTarget) =>
  target.kind === 'total' ? 'Monthly total' : target.name;

/**
 * Ask Moni to suggest a budget (#80): a few short questions, then a monthly amount the user can
 * change before setting it. From Edit budgets the amount goes into that page's draft.
 */
export default function SuggestBudgetScreen() {
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{
    category?: string;
    from?: string;
  }>();
  const data = useBudgetData();
  const { currency } = data;
  const intoDraft = params.from === 'edit';
  const gate = useAiGate('chat');
  const category = params.category
    ? data.categories.find((each) => each.id === params.category)
    : undefined;
  const [step, setStep] = useState<Step>(() =>
    category
      ? {
          kind: 'idle',
          target: {
            kind: 'category',
            id: category.id,
            name: category.name,
          },
        }
      : { kind: 'pick' },
  );

  const thisMonth = deviceCalendar.monthKey(data.now);
  const monthsFor = (target: SuggestTarget) =>
    suggestionMonths(
      data.transactions,
      { month: thisMonth, currency, calendar: deviceCalendar },
      target.kind === 'total' ? null : target.id,
    );
  const request = (
    target: SuggestTarget,
    answers: { question: string; answer: string }[],
  ) => ({
    category: target.kind === 'total' ? null : target.name,
    currency,
    months: monthsFor(target),
    answers,
    tone: profilePreferences$.peek()?.moni_tone,
  });
  const averageLine = (target: SuggestTarget) => {
    const months = monthsFor(target);
    if (!months.length) return null;
    const average =
      months.reduce(
        (sum, month) => sum + Number(month.spentMinor),
        0,
      ) / months.length;
    return `You averaged ${formatMoney(average, currency, { whole: true })} over ${months.length === 1 ? '1 month' : `${months.length} months`}`;
  };
  const lastMonth =
    step.kind === 'pick'
      ? spendByMonth(data.transactions, {
          month: shiftMonth(thisMonth, -1),
          count: 1,
          currency,
          calendar: deviceCalendar,
        })
      : null;
  const spentLastMonth = (target: SuggestTarget) =>
    lastMonth
      ? formatMoney(
          (target.kind === 'total'
            ? lastMonth.totals[0]
            : lastMonth.byCategory.get(target.id)?.[0]) ?? 0,
          currency,
          { whole: true },
        )
      : '';

  const ask = (target: SuggestTarget) =>
    gate(() => {
      setStep({ kind: 'waiting', target });
      void getAiClient('chat')
        .suggestBudget(request(target, []))
        .then((result) =>
          setStep(
            result.status === 'ok' && result.step === 'questions'
              ? {
                  kind: 'questions',
                  target,
                  questions: result.questions,
                  answers: result.questions.map(() => ''),
                }
              : { kind: 'failed', target },
          ),
        );
    });

  const suggest = (
    target: SuggestTarget,
    questions: BudgetQuestion[],
    answers: string[],
  ) => {
    setStep({ kind: 'thinking', target, questions, answers });
    void getAiClient('chat')
      .suggestBudget(
        request(
          target,
          questions.map((question, index) => ({
            question: question.text,
            answer: answers[index]!.trim(),
          })),
        ),
      )
      .then((result) =>
        setStep(
          result.status === 'ok' && result.step === 'suggestion'
            ? {
                kind: 'suggestion',
                target,
                amountMinor: result.amountMinor as MinorAmount,
                note: result.note,
              }
            : { kind: 'failed', target },
        ),
      );
  };

  useEffect(() => {
    if (step.kind === 'idle') ask(step.target);
    // Asks once, for the category the page opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setBudget = async (
    target: SuggestTarget,
    amountMinor: MinorAmount,
  ) => {
    if (intoDraft) {
      pickedSuggestion$.set({ target, amountMinor });
      router.back();
      return;
    }
    try {
      if (target.kind === 'total')
        await setMonthlyBudget(Number(amountMinor) / 100);
      else await upsertCategoryBudget(target.id, currency, amountMinor);
    } catch {
      showToast({ text: "Couldn't save that. Try again.", tone: 'removed' });
      return;
    }
    showToast({
      text: `${nameOf(target)} set to ${formatMoney(amountMinor, currency, { whole: true })}`,
    });
    router.back();
  };

  return (
    <Page
      headerScrolls
      screen="budget"
      kind="pushed"
      title="Ask Moni"
      subtitle={
        step.kind === 'pick'
          ? 'Suggest a budget'
          : nameOf(step.target)
      }
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step.kind === 'pick' ? (
          <ListCard>
            {[
              { kind: 'total' } as const,
              ...data.categories.map((each) => ({
                kind: 'category' as const,
                id: each.id,
                name: each.name,
              })),
            ].map((target) => {
              const found =
                target.kind === 'category'
                  ? data.categories.find(
                      (each) => each.id === target.id,
                    )
                  : null;
              const name = nameOf(target);
              return (
                <Press
                  key={target.kind === 'total' ? 'total' : target.id}
                  testID={tid('budget', 'suggest', 'pick', name)}
                  accessibilityLabel={`Suggest a budget for ${nameOf(target)}`}
                  onPress={() => ask(target)}
                  pressedClassName="bg-sand-light"
                  className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
                >
                  <TintBubble
                    icon={
                      found
                        ? resolveTransactionIcon(
                            found.icon,
                            'expense',
                          )
                        : 'calendar-month-outline'
                    }
                    color={found?.color ?? null}
                  />
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {nameOf(target)}
                    </Text>
                    <Text
                      variant="meta"
                      className="text-muted"
                      numberOfLines={1}
                    >
                      {`${spentLastMonth(target)} last month`}
                    </Text>
                  </View>
                  <IconSymbol
                    name="chevron-right"
                    size={20}
                    color={tokens.muted}
                  />
                </Press>
              );
            })}
          </ListCard>
        ) : null}

        {step.kind === 'waiting' || step.kind === 'thinking' ? (
          <Text
            testID={tid('budget', 'suggest', 'thinking')}
            variant="body"
            className="text-muted"
          >
            {step.kind === 'waiting'
              ? 'Moni is thinking of a few questions…'
              : 'Moni is working it out…'}
          </Text>
        ) : null}

        {step.kind === 'questions'
          ? step.questions.map((question, index) => (
              <View
                key={question.text}
                className="gap-2.5"
              >
                <Text
                  variant="cardTitle"
                  className="text-foreground"
                >
                  {question.text}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {question.choices.map((choice) => (
                    <Chip
                      key={choice}
                      testID={tid(
                        'budget',
                        'suggest',
                        'answer',
                        index,
                        choice,
                      )}
                      label={choice}
                      selected={step.answers[index] === choice}
                      onPress={() =>
                        setStep({
                          ...step,
                          answers: step.answers.map((each, at) =>
                            at === index ? choice : each,
                          ),
                        })
                      }
                    />
                  ))}
                </View>
                <TextInput
                  testID={tid('budget', 'suggest', 'typed', index)}
                  accessibilityLabel={`Your own answer to: ${question.text}`}
                  placeholder="Or type your own"
                  placeholderTextColor={tokens.muted}
                  maxLength={200}
                  value={
                    question.choices.includes(step.answers[index]!)
                      ? ''
                      : step.answers[index]
                  }
                  onChangeText={(text) =>
                    setStep({
                      ...step,
                      answers: step.answers.map((each, at) =>
                        at === index ? text : each,
                      ),
                    })
                  }
                  className="h-11 rounded-field bg-sand px-3.5 font-display text-[15px] text-foreground"
                />
              </View>
            ))
          : null}

        {step.kind === 'suggestion' ? (
          <View className="gap-3 rounded-card bg-card px-[18px] py-4">
            <Text
              variant="caps"
              className="text-muted"
            >
              Moni suggests
            </Text>
            <InPlaceGroup>
              <InPlaceField
                testID={tid('budget', 'suggest', 'amount')}
                label="Suggested budget"
                kind="amount"
                prefix={currencySymbol(currency)}
                whole
                max={PLAN_LIMIT_MINOR}
                value={step.amountMinor}
                onSave={(minor) =>
                  setStep({ ...step, amountMinor: minor })
                }
              >
                <Text
                  className="text-[40px] leading-[44px] font-display-bold text-foreground"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {`${formatMoney(step.amountMinor, currency, { whole: true })} a month`}
                </Text>
              </InPlaceField>
            </InPlaceGroup>
            {averageLine(step.target) ? (
              <Text
                testID={tid('budget', 'suggest', 'average')}
                variant="meta"
                className="text-muted"
              >
                {averageLine(step.target)}
              </Text>
            ) : null}
            <Text
              variant="body"
              className="text-ink-2"
            >
              {step.note}
            </Text>
          </View>
        ) : null}

        {step.kind === 'failed' ? (
          <Text
            testID={tid('budget', 'suggest', 'failed')}
            variant="body"
            className="text-muted"
          >
            {"Moni couldn't suggest one right now."}
          </Text>
        ) : null}
      </PageScroll>

      {step.kind === 'questions' ||
      step.kind === 'suggestion' ||
      step.kind === 'failed' ||
      step.kind === 'idle' ? (
        <View className="gap-2 border-t-[1.5px] border-sand bg-canvas px-5 pb-[26px] pt-3">
          {step.kind === 'questions' ? (
            <Button
              testID={tid('budget', 'suggest', 'next')}
              label="Suggest a budget"
              pinned
              disabled={step.answers.some((answer) => !answer.trim())}
              onPress={() =>
                suggest(step.target, step.questions, step.answers)
              }
            />
          ) : step.kind === 'suggestion' ? (
            <Button
              testID={tid('budget', 'suggest', 'set')}
              label={intoDraft ? 'Use this amount' : 'Set budget'}
              pinned
              onPress={() =>
                void setBudget(step.target, step.amountMinor)
              }
            />
          ) : (
            <Button
              testID={tid('budget', 'suggest', 'retry')}
              label={step.kind === 'idle' ? 'Ask Moni' : 'Try again'}
              pinned
              onPress={() => ask(step.target)}
            />
          )}
        </View>
      ) : null}
    </Page>
  );
}
