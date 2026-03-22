import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { BudgetCoachCardsV1, SummaryInsightCardsV1 } from '@repo/types';

type InsightPayload = BudgetCoachCardsV1 | SummaryInsightCardsV1 | null;

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

function kindStyles(kind: NonNullable<InsightPayload>['cards'][number]['kind']): {
  border: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
} {
  switch (kind) {
    case 'risk':
      return {
        border: 'border-red-300 dark:border-red-600/80',
        icon: 'trending-up',
        iconColor: '#dc2626',
      };
    case 'positive':
      return {
        border: 'border-emerald-300 dark:border-emerald-600/80',
        icon: 'eco',
        iconColor: '#059669',
      };
    case 'savings_opportunity':
      return {
        border: 'border-amber-300 dark:border-amber-600/80',
        icon: 'account-balance',
        iconColor: '#d97706',
      };
    default:
      return {
        border: 'border-slate-200 dark:border-slate-600',
        icon: 'insights',
        iconColor: '#64748b',
      };
  }
}

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
  return (
    <View className="rounded-2xl overflow-hidden mb-4 border border-indigo-200/60 dark:border-indigo-500/40 bg-indigo-50/80 dark:bg-slate-800/90">
      <View className="flex-row items-center justify-between px-4 py-3 bg-indigo-500/90 dark:bg-indigo-900/80">
        <View className="flex-row items-center flex-1 min-w-0 pr-2">
          <MaterialIcons name="auto-awesome" size={22} color="#e0e7ff" />
          <Text className="ml-2 text-base font-bold text-white" numberOfLines={1}>
            Budget coach
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={disabled || generating}
          className="flex-row items-center bg-white/20 px-3 py-1.5 rounded-full"
          activeOpacity={0.85}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#e0e7ff" />
          ) : (
            <MaterialIcons name="refresh" size={18} color="#e0e7ff" />
          )}
          <Text className="ml-1.5 text-xs font-semibold text-white">
            {generating ? '…' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="px-3 py-3">
        {onManageBudgets ? (
          <Pressable
            onPress={onManageBudgets}
            className="mb-2 flex-row items-center justify-between rounded-lg bg-white/60 dark:bg-slate-900/50 px-2 py-1.5"
          >
            <Text className="text-xs text-slate-700 dark:text-slate-300 flex-1 pr-2">
              {hasBudgetsConfigured
                ? 'Edit monthly category budgets'
                : 'Set monthly budgets per category (all wallets)'}
            </Text>
            <MaterialIcons name="chevron-right" size={18} color="#64748b" />
          </Pressable>
        ) : null}

        {stale && !generating ? (
          <Text className="text-xs text-amber-800 dark:text-amber-200 mb-2">
            Your data changed — refresh for updated coaching.
          </Text>
        ) : null}

        {errorMessage ? (
          <Text className="text-sm text-red-600 dark:text-red-400 mb-2">{errorMessage}</Text>
        ) : null}

        {!insight?.cards?.length && !generating ? (
          <Text className="text-sm text-slate-600 dark:text-slate-400 leading-5">
            Spending is analyzed against your category budgets for this calendar month. The model suggests
            habits to save money — numbers are computed on-device first.
          </Text>
        ) : null}

        {generating && !insight?.cards?.length ? (
          <View className="py-6 items-center">
            <ActivityIndicator size="large" color="#6366f1" />
            <Text className="mt-2 text-sm text-slate-600 dark:text-slate-400">Generating insights…</Text>
          </View>
        ) : null}

        {insight?.cards?.map((card, i) => {
          const st = kindStyles(card.kind);
          return (
            <View
              key={`${card.title}-${i}`}
              className={`rounded-xl border bg-white dark:bg-slate-900/80 p-3 mb-2 ${st.border}`}
            >
              <View className="flex-row items-start">
                <MaterialIcons name={st.icon} size={20} color={st.iconColor} style={{ marginTop: 2 }} />
                <View className="ml-2 flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white">{card.title}</Text>
                  <Text className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-5">{card.body}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {insight?.disclaimer ? (
          <Text className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 leading-4">{insight.disclaimer}</Text>
        ) : null}
      </View>
    </View>
  );
}
