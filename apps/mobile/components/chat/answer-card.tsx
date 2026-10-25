import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { PaceChart } from '@/components/charts/pace-chart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { AnswerCard as Card, BillLine } from '@/lib/ai/chat/answer-cards';
import type { ChatMessage } from '@/lib/ai/chat/messages';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { transactions$ } from '@/lib/finance/selectors';
import { debtPhrase, dueWhen } from '@/lib/finance/spent-summary';
import { tid } from '@/lib/test-ids';

import { CapturesCard } from './captures-card';
import { InkCardLabel, useOnInk } from './ink-card';

type CardMessage = Extract<ChatMessage, { kind: 'assistant_card' }>;

/** "31 Oct": the last day of the month a question was asked in. */
function monthEndLabel(asked: Date): string {
  const end = new Date(asked.getFullYear(), asked.getMonth() + 1, 0);
  return formatDate(end, asked).replace(/^\S+ /, '');
}

/** Spend per day this month in `currency`, for one category or all. */
function useMonthDaily(createdAt: string, currency: string, categoryId: string | null) {
  const { user } = useAuth();
  const transactions = useValue(transactions$({ userId: user?.id ?? null }));
  return useMemo(() => {
    const now = new Date();
    const asked = new Date(createdAt);
    if (asked.getFullYear() !== now.getFullYear() || asked.getMonth() !== now.getMonth())
      return null;
    const values = Array.from({ length: now.getDate() }, () => 0);
    for (const tx of transactions) {
      if (tx.type !== 'expense' || tx.analysisExcluded || tx.currency !== currency) continue;
      if (categoryId && tx.categoryId !== categoryId) continue;
      const date = new Date(tx.transactionDate);
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) continue;
      if (date.getDate() > values.length) continue;
      values[date.getDate() - 1]! += Number(tx.amountMinor);
    }
    return { month: { year: now.getFullYear(), month: now.getMonth() }, values };
  }, [transactions, createdAt, currency, categoryId]);
}

/** Spent of budget on an Ink card: Sand track, Ink 2 fill, or full Coral and "RMx over". */
function Bar({ spent, budget, currency }: { spent: number; budget: number; currency: string }) {
  const onInk = useOnInk();
  const over = spent > budget;
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <Text
          variant="meta"
          className={onInk.body}
        >
          {`${whole(spent)} of ${whole(budget)}`}
        </Text>
        <Text
          variant="meta"
          className={`font-display-bold ${over ? 'text-coral' : onInk.body}`}
        >
          {over ? `${whole(spent - budget)} over` : `${whole(budget - spent)} left`}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-sand">
        <View
          className={`h-2 rounded-full ${over ? 'bg-coral' : 'bg-ink-2'}`}
          style={{ width: `${Math.min(100, (spent / Math.max(budget, 1)) * 100)}%` }}
        />
      </View>
    </View>
  );
}

const PLOT_H = 84;
const BASE_Y = 62;
const BAR_MAX = 46;

/** The money going out for the rest of the month: one bar per bill, the asked one in Lemon. */
function BillTimeline({
  subject,
  ahead,
  currency,
  asked,
}: {
  subject: BillLine;
  ahead: readonly BillLine[];
  currency: string;
  asked: Date;
}) {
  const tokens = useThemeTokens();
  const onInk = useOnInk();
  const [width, setWidth] = useState(0);
  const first = parseLocalDateInput(subject.dueDate);
  if (!first) return null;
  const endDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const left = 23.8;
  const right = Math.max(width - 6, left);
  const x = (day: number) =>
    endDay === first.getDate() ? left : left + ((day - first.getDate()) / (endDay - first.getDate())) * (right - left);
  const bars = ahead.flatMap((bill) => {
    const date = parseLocalDateInput(bill.dueDate);
    return date ? [{ ...bill, day: date.getDate() }] : [];
  });
  const most = Math.max(...bars.map((bar) => bar.amount), 1);
  const height = (amount: number) => Math.max(6, (amount / most) * BAR_MAX);
  const isSubject = (bar: (typeof bars)[number]) => bar.name === subject.name && bar.dueDate === subject.dueDate;
  const others = bars.filter((bar) => !isSubject(bar));
  const biggest = others.reduce<(typeof bars)[number] | null>(
    (top, bar) => (!top || bar.amount > top.amount ? bar : top),
    null,
  );
  const dayLabels = [...new Set(others.map((bar) => bar.day))].filter(
    (day) => day !== first.getDate() && x(endDay) - x(day) > 28,
  );
  const label = (key: string, center: number, top: number, text: string, strong: boolean) => (
    <View
      key={key}
      pointerEvents="none"
      className="absolute w-24 items-center"
      style={{ left: center - 48, top }}
    >
      <Text
        className={`text-[12px] leading-[16px] ${strong ? `font-display-bold text-primary-foreground` : onInk.meta}`}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Money going out for the rest of the month: ${bars
        .map((bar) => `${bar.name} ${formatMoney(bar.amount, currency)} on ${bar.day}`)
        .join(', ')}.`}
      style={{ height: PLOT_H }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width ? (
        <>
          <Svg
            width={width}
            height={PLOT_H}
          >
            <Line
              x1={6}
              y1={BASE_Y + 0.5}
              x2={width - 6}
              y2={BASE_Y + 0.5}
              stroke={tokens.primaryForeground}
              strokeOpacity={0.25}
              strokeWidth={1}
            />
            {bars.map((bar) => (
              <Rect
                key={`${bar.name}-${bar.dueDate}`}
                x={x(bar.day) - 6}
                y={BASE_Y - height(bar.amount)}
                width={12}
                height={height(bar.amount)}
                rx={height(bar.amount) < 8 ? 3 : 4}
                fill={isSubject(bar) ? tokens.lemon : tokens.muted}
              />
            ))}
          </Svg>
          {label('amount', x(first.getDate()), BASE_Y - height(subject.amount) - 19, formatMoney(subject.amount, currency), true)}
          {biggest
            ? label(
                'biggest',
                x(biggest.day),
                BASE_Y - height(biggest.amount) - 20,
                `${biggest.name} ${formatMoney(biggest.amount, currency, { whole: true })}`,
                false,
              )
            : null}
          {label('first', x(first.getDate()), 68, formatDate(first, asked).replace(/ \S+$/, ''), true)}
          {dayLabels.map((day) => label(`day-${day}`, x(day), 68, String(day), false))}
          <Text
            className={`absolute right-1.5 text-[12px] leading-[16px] ${onInk.meta}`}
            style={{ top: 68 }}
          >
            {monthEndLabel(first)}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function LinkButton({
  testID,
  label,
  icon,
  primary,
  onPress,
}: {
  testID: ReturnType<typeof tid>;
  label: string;
  icon?: 'chart-box';
  primary: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const ink = primary ? tokens.foreground : tokens.primaryForeground;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName={primary ? 'bg-sand-light' : 'bg-ink-2'}
      className={`h-11 flex-row items-center pl-4 pr-2.5 ${icon ? 'gap-1.5' : 'gap-0.5'} ${primary ? 'bg-card' : 'bg-ink-2/60'}`}
    >
      {icon ? (
        <IconSymbol
          name={icon}
          size={18}
          color={ink}
        />
      ) : null}
      <Text
        className="text-[15px] font-display-semibold"
        style={{ color: ink }}
      >
        {label}
      </Text>
      <View style={icon ? { marginLeft: -4 } : undefined}>
        <IconSymbol
          name="chevron-right"
          size={20}
          color={ink}
        />
      </View>
    </Press>
  );
}

/** A generative answer: Ink card, ledger numbers, the model's reply as its caption. */
export function AnswerCard({ message }: { message: CardMessage }) {
  if (message.card.kind === 'captures') return <CapturesCard proposalIds={message.card.proposalIds} />;
  return (
    <LedgerAnswer
      message={message}
      card={message.card}
    />
  );
}

type LedgerCard = Exclude<Card, { kind: 'captures' }>;

function LedgerAnswer({ message, card }: { message: CardMessage; card: LedgerCard }) {
  const onInk = useOnInk();
  const currency = useMainCurrency();
  const categoryId = card.kind === 'category_spend' ? card.categoryId : null;
  const categoryName = useValue(() =>
    categoryId ? (financeProjection$.categoriesById[categoryId].name.get() ?? 'This category') : '',
  );
  const daily = useMonthDaily(message.createdAt, currency, categoryId);
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  const asked = new Date(message.createdAt);
  const openBudget = () => router.dismissTo('/budget');

  const title = titleFor(card, categoryName, currency, asked);
  const after = afterChart(card, categoryName, currency, asked);

  return (
    <View
      accessibilityLabel={`Moni's answer. ${title}. ${message.content}`}
      className="gap-3 rounded-card bg-primary p-[18px]"
    >
      <InkCardLabel label="Moni" />
      <View className="gap-1.5">
        <Text
          testID={tid('chat', 'answer', 'title')}
          variant="sectionTitle"
          className="text-primary-foreground"
        >
          {title}
        </Text>
        {message.content ? (
          <Text
            variant="body"
            className={onInk.body}
          >
            {message.content}
          </Text>
        ) : null}
      </View>

      {card.kind === 'category_spend' && card.budget !== null ? (
        <Bar
          spent={card.spent}
          budget={card.budget}
          currency={currency}
        />
      ) : null}
      {card.kind === 'budget_progress' ? (
        <Bar
          spent={card.spent}
          budget={card.budget}
          currency={currency}
        />
      ) : null}

      {card.kind !== 'bill_due' && daily ? (
        <View className="-mx-2 rounded-[18px] bg-card px-2 py-2.5">
          <PaceChart
            screen="chat"
            mode="pace"
            series={daily}
            budget={card.budget}
            currency={currency}
          />
        </View>
      ) : null}

      {card.kind === 'bill_due' && card.ahead?.length ? (
        <View className="gap-1.5">
          <BillTimeline
            subject={card}
            ahead={card.ahead}
            currency={currency}
            asked={asked}
          />
          {after ? (
            <Text
              variant="meta"
              className={onInk.meta}
            >
              {after}
            </Text>
          ) : null}
        </View>
      ) : after ? (
        <Text
          variant="body"
          className={onInk.body}
        >
          {after}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {card.kind === 'bill_due' ? (
          <LinkButton
            testID={tid('chat', 'answer', 'bill')}
            label={`${card.name} bill`}
            primary
            onPress={() =>
              router.push({ pathname: '/bill/[seriesKey]', params: { seriesKey: card.seriesKey } })
            }
          />
        ) : (
          <LinkButton
            testID={tid('chat', 'answer', 'open-budget')}
            label="Open Budget"
            icon="chart-box"
            primary
            onPress={openBudget}
          />
        )}
        {card.kind === 'category_spend' ? (
          <LinkButton
            testID={tid('chat', 'answer', 'category')}
            label={categoryName}
            primary={false}
            onPress={() =>
              router.push({
                pathname: '/budget/[categoryId]',
                params: { categoryId: card.categoryId },
              })
            }
          />
        ) : null}
      </View>
    </View>
  );

  function afterChart(answer: LedgerCard, name: string, money: string, at: Date): string | null {
    switch (answer.kind) {
      case 'category_spend':
        return answer.budget !== null && answer.spent > answer.budget
          ? `Budget shows ${name} as over until ${monthEndLabel(at)}. If ${whole(answer.budget)} is too tight, change it there.`
          : null;
      case 'budget_progress':
        return answer.perDay !== null
          ? `That's ${whole(answer.perDay)} a day for ${answer.daysLeft} ${answer.daysLeft === 1 ? 'day' : 'days'}.`
          : null;
      case 'bill_due': {
        if (!answer.ahead?.length) return null;
        const owed = answer.owed ?? [];
        const total =
          answer.ahead.reduce((sum, bill) => sum + bill.amount, 0) +
          owed.reduce((sum, debt) => sum + Number(debt.amountMinor), 0);
        const people = debtPhrase(owed, money);
        const allows = answer.perDay ? ` Your ${whole(answer.perDay)} a day already allows for it.` : '';
        return `${people ? `Bills and ${people}` : 'Bills'} come to ${formatMoney(total, money)} before ${monthEndLabel(at)}.${allows}`;
      }
    }
  }
}

function titleFor(card: LedgerCard, categoryName: string, currency: string, asked: Date): string {
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  switch (card.kind) {
    case 'category_spend':
      if (card.budget === null) return `${whole(card.spent)} on ${categoryName} this month`;
      return card.spent > card.budget
        ? `${whole(card.spent)} on ${categoryName}, ${whole(card.spent - card.budget)} over`
        : `${whole(card.spent)} on ${categoryName}, ${whole(card.budget - card.spent)} left`;
    case 'budget_progress':
      return card.left < 0
        ? `${whole(-card.left)} over this month`
        : `${whole(card.left)} left for ${card.daysLeft} ${card.daysLeft === 1 ? 'day' : 'days'}`;
    case 'bill_due':
      return `${card.name} takes ${formatMoney(card.amount, currency)} ${dueWhen(card.dueDate, asked)}`;
  }
}
