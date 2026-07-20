import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  BudgetCoachCardsV1,
  SummaryInsightCardsV1,
} from '@repo/types';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Surface } from '@/components/ui/surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type InsightPayload =
  | BudgetCoachCardsV1
  | SummaryInsightCardsV1
  | null;

type Props = {
  insight: InsightPayload;
  generating: boolean;
  stale: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  disabled?: boolean;
  onManageBudgets?: () => void;
  hasBudgetsConfigured?: boolean;
};

type InsightStyle = {
  surfaceClassName: string;
  icon: IconSymbolName;
  iconColor: string;
};

function kindStyle(
  kind: NonNullable<InsightPayload>['cards'][number]['kind'],
  tokens: ReturnType<typeof useThemeTokens>,
): InsightStyle {
  switch (kind) {
    case 'risk':
      return {
        surfaceClassName: 'bg-danger/10',
        icon: 'trending-up',
        iconColor: tokens.danger,
      };
    case 'positive':
      return {
        surfaceClassName: 'bg-primary-muted',
        icon: 'eco',
        iconColor: tokens.success,
      };
    case 'savings_opportunity':
      return {
        surfaceClassName: 'bg-accent-lemon/20',
        icon: 'account-balance',
        iconColor: tokens.warning,
      };
    default:
      return {
        surfaceClassName: 'bg-surface-2',
        icon: 'insights',
        iconColor: tokens.muted,
      };
  }
}

/** Evidence-led coaching only supplements the deterministic Insights story. */
export function AiInsightSection({
  insight,
  generating,
  stale,
  errorMessage,
  onRefresh,
  disabled,
  onManageBudgets,
  hasBudgetsConfigured,
}: Props) {
  const tokens = useThemeTokens();

  return (
    <Surface tone="tray" className="mb-6 overflow-hidden">
      <View className="flex-row items-center justify-between bg-primary px-4 py-3">
        <View className="min-w-0 flex-1 flex-row items-center pr-3">
          <IconSymbol
            name="auto-awesome"
            size={20}
            color={tokens.primaryForeground}
          />
          <Text
            className="ml-2 text-base font-bold text-primary-foreground"
            numberOfLines={1}
          >
            Budget coach
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={disabled || generating}
          className="min-h-10 flex-row items-center rounded-full bg-primary-foreground/15 px-3"
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Refresh budget coach"
        >
          {generating ? (
            <ActivityIndicator
              size="small"
              color={tokens.primaryForeground}
            />
          ) : (
            <IconSymbol
              name="refresh"
              size={17}
              color={tokens.primaryForeground}
            />
          )}
          <Text className="ml-1.5 text-xs font-bold text-primary-foreground">
            {generating ? 'Working' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 py-4">
        {onManageBudgets ? (
          <Pressable
            onPress={onManageBudgets}
            className="mb-3 min-h-12 flex-row items-center justify-between rounded-2xl bg-card px-3 py-2 active:bg-surface-2"
            accessibilityRole="button"
          >
            <Text className="flex-1 pr-2 text-sm text-foreground">
              {hasBudgetsConfigured
                ? 'Edit monthly category budgets'
                : 'Set monthly category budgets'}
            </Text>
            <IconSymbol
              name="chevron-right"
              size={19}
              color={tokens.muted}
            />
          </Pressable>
        ) : null}

        {stale && !generating ? (
          <Text className="mb-3 text-sm leading-5 text-warning">
            Your data changed. Refresh for updated coaching.
          </Text>
        ) : null}
        {errorMessage ? (
          <Text className="mb-3 text-sm leading-5 text-danger">
            {errorMessage}
          </Text>
        ) : null}
        {!insight?.cards?.length && !generating ? (
          <Text className="text-sm leading-5 text-muted">
            Spending is compared with your category budgets for this
            month. Amounts are calculated on this device first.
          </Text>
        ) : null}
        {generating && !insight?.cards?.length ? (
          <View className="items-center py-7">
            <ActivityIndicator size="large" color={tokens.primary} />
            <Text className="mt-3 text-sm text-muted">
              Preparing an evidence-led summary…
            </Text>
          </View>
        ) : null}

        {insight?.cards?.map((card, index) => {
          const style = kindStyle(card.kind, tokens);
          return (
            <View
              key={[card.title, index].join('-')}
              className={[
                'mb-2 rounded-2xl p-3',
                style.surfaceClassName,
              ].join(' ')}
            >
              <View className="flex-row items-start">
                <IconSymbol
                  name={style.icon}
                  size={20}
                  color={style.iconColor}
                  style={{ marginTop: 1 }}
                />
                <View className="ml-3 min-w-0 flex-1">
                  <Text className="text-base font-bold text-foreground">
                    {card.title}
                  </Text>
                  <Text className="mt-1 text-sm leading-5 text-muted">
                    {card.body}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
        {insight?.disclaimer ? (
          <Text className="mt-1 text-xs leading-4 text-muted">
            {insight.disclaimer}
          </Text>
        ) : null}
      </View>
    </Surface>
  );
}
