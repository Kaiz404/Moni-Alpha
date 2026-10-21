import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { PaceChart } from '@/components/charts/pace-chart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { AnswerCard as Card } from '@/lib/ai/chat/answer-cards';
import type { ChatMessage } from '@/lib/ai/chat/messages';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { transactions$ } from '@/lib/finance/selectors';
import { dueWhen } from '@/lib/finance/spent-summary';
import { tid } from '@/lib/test-ids';

type CardMessage = Extract<ChatMessage, { kind: 'assistant_card' }>;

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

function Bar({ spent, budget, currency }: { spent: number; budget: number; currency: string }) {
  const over = spent > budget;
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <Text
          variant="meta"
          className="text-primary-foreground"
        >
          {`${whole(spent)} of ${whole(budget)}`}
        </Text>
        <Text
          variant="meta"
          className={`font-display-bold ${over ? 'text-coral' : 'text-primary-foreground'}`}
        >
          {over ? `${whole(spent - budget)} over` : `${whole(budget - spent)} left`}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-ink-2">
        <View
          className={`h-2 rounded-full ${over ? 'bg-coral' : 'bg-primary-foreground'}`}
          style={{ width: `${Math.min(100, (spent / Math.max(budget, 1)) * 100)}%` }}
        />
      </View>
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
  const ink = primary ? tokens.primary : tokens.primaryForeground;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName={primary ? 'bg-sand-light' : 'bg-ink-2'}
      className={`h-11 flex-row items-center gap-1 pl-3.5 pr-2.5 ${primary ? 'bg-primary-foreground' : 'bg-ink-2/60'}`}
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
      <IconSymbol
        name="chevron-right"
        size={18}
        color={ink}
      />
    </Press>
  );
}

/** A generative answer: Ink card, ledger numbers, the model's reply as its caption. */
export function AnswerCard({ message }: { message: CardMessage }) {
  const tokens = useThemeTokens();
  const currency = useMainCurrency();
  const { card } = message;
  const categoryId = card.kind === 'category_spend' ? card.categoryId : null;
  const categoryName = useValue(() =>
    categoryId ? (financeProjection$.categoriesById[categoryId].name.get() ?? 'This category') : '',
  );
  const daily = useMonthDaily(message.createdAt, currency, categoryId);
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  const openBudget = () => router.dismissTo('/budget');

  const title = titleFor(card, categoryName, currency, new Date(message.createdAt));

  return (
    <View
      accessibilityLabel={`Moni's answer. ${title}. ${message.content}`}
      className="mb-2 gap-3 rounded-card bg-primary p-[18px]"
    >
      <View className="flex-row items-center gap-1.5">
        <IconSymbol
          name="creation"
          size={16}
          color={tokens.lilac}
        />
        <Text
          variant="caps"
          className="text-primary-foreground opacity-70"
        >
          Moni
        </Text>
      </View>
      <View className="gap-1">
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
            className="text-primary-foreground opacity-85"
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
        <View className="rounded-tile bg-card px-3.5 py-3">
          <PaceChart
            screen="chat"
            mode="pace"
            series={daily}
            budget={card.budget}
            currency={currency}
          />
        </View>
      ) : null}

      {card.kind === 'budget_progress' && card.perDay !== null ? (
        <Text
          variant="body"
          className="text-primary-foreground opacity-85"
        >
          {`That's ${whole(card.perDay)} a day for ${card.daysLeft} ${card.daysLeft === 1 ? 'day' : 'days'}.`}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <LinkButton
          testID={tid('chat', 'answer', 'open-budget')}
          label="Open Budget"
          icon="chart-box"
          primary
          onPress={openBudget}
        />
        {card.kind === 'category_spend' ? (
          <LinkButton
            testID={tid('chat', 'answer', 'category')}
            label={categoryName}
            primary={false}
            onPress={() =>
              router.dismissTo({
                pathname: '/activity',
                params: { categoryId: card.categoryId, currency },
              })
            }
          />
        ) : null}
      </View>
    </View>
  );
}

function titleFor(card: Card, categoryName: string, currency: string, asked: Date): string {
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
