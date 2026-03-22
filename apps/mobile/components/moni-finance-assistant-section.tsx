import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { MoniFinanceAssistantV1 } from '@repo/types';

type Props = {
  insight: MoniFinanceAssistantV1 | null;
  generating: boolean;
  stale: boolean;
  errorMessage: string | null;
  onRegenerate: () => void;
  disabled?: boolean;
  onManageBudgets?: () => void;
  hasBudgetsConfigured?: boolean;
};

function agentAccent(agentKey: MoniFinanceAssistantV1['insights'][number]['agentKey']): {
  border: string;
  bar: string;
  icon: keyof typeof MaterialIcons.glyphMap;
} {
  switch (agentKey) {
    case 'spending_trend':
      return {
        border: 'border-violet-300 dark:border-violet-600/70',
        bar: 'bg-violet-500',
        icon: 'show-chart',
      };
    case 'budget_advisor':
      return {
        border: 'border-emerald-300 dark:border-emerald-600/70',
        bar: 'bg-emerald-500',
        icon: 'account-balance-wallet',
      };
    case 'spending_story':
      return {
        border: 'border-amber-300 dark:border-amber-600/70',
        bar: 'bg-amber-500',
        icon: 'menu-book',
      };
    default:
      return {
        border: 'border-slate-200 dark:border-slate-600',
        bar: 'bg-slate-400',
        icon: 'insights',
      };
  }
}

export function MoniFinanceAssistantSection({
  insight,
  generating,
  stale,
  errorMessage,
  onRegenerate,
  disabled,
  onManageBudgets,
  hasBudgetsConfigured,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (generating) setExpanded(true);
  }, [generating]);

  const hasInsights = Boolean(insight?.insights?.length);
  /** Keep empty / loading states visible; only fold away generated insight cards. */
  const showBody = !hasInsights || generating || expanded;
  const canToggleCollapse = hasInsights && !generating;

  return (
    <View className="rounded-2xl overflow-hidden mb-4 border border-indigo-200/60 dark:border-indigo-500/40 bg-indigo-50/80 dark:bg-slate-800/90">
      <View className="flex-row items-center justify-between px-4 py-3 bg-indigo-600 dark:bg-indigo-950/90">
        <Pressable
          onPress={() => {
            if (canToggleCollapse) setExpanded((v) => !v);
          }}
          className="flex-row items-center flex-1 min-w-0 pr-2"
          accessibilityRole={canToggleCollapse ? 'button' : undefined}
          accessibilityLabel={
            canToggleCollapse
              ? expanded
                ? 'Collapse Moni Finance Assistant'
                : 'Expand Moni Finance Assistant'
              : undefined
          }
        >
          <MaterialIcons name="smart-toy" size={22} color="#e0e7ff" />
          <View className="ml-2 flex-1 min-w-0">
            <Text className="text-base font-bold text-white" numberOfLines={1}>
              Moni Finance Assistant
            </Text>
            <Text className="text-[11px] text-indigo-100 mt-0.5" numberOfLines={2}>
              Three on-device analysts: trends, budgets, and spending story
            </Text>
          </View>
          {canToggleCollapse ? (
            <MaterialIcons
              name={expanded ? 'expand-less' : 'expand-more'}
              size={26}
              color="#e0e7ff"
              style={{ marginLeft: 4 }}
            />
          ) : null}
        </Pressable>
        <TouchableOpacity
          onPress={onRegenerate}
          disabled={disabled || generating}
          className="flex-row items-center bg-white/20 px-3 py-1.5 rounded-full shrink-0"
          activeOpacity={0.85}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#e0e7ff" />
          ) : (
            <MaterialIcons name="refresh" size={18} color="#e0e7ff" />
          )}
          <Text className="ml-1.5 text-xs font-semibold text-white">
            {generating ? '…' : 'Regenerate'}
          </Text>
        </TouchableOpacity>
      </View>

      {!expanded && hasInsights && !generating ? (
        <Pressable
          onPress={() => setExpanded(true)}
          className="px-4 py-2 bg-indigo-500/25 dark:bg-indigo-950/50 border-b border-indigo-400/20"
        >
          <Text className="text-xs text-indigo-900 dark:text-indigo-100" numberOfLines={2}>
            {insight?.insights.map((b) => b.title).join(' · ')}
          </Text>
        </Pressable>
      ) : null}

      {showBody ? (
      <View className="px-3 py-3">
        {onManageBudgets ? (
          <Pressable
            onPress={onManageBudgets}
            className="mb-3 flex-row items-center justify-between rounded-lg bg-white/60 dark:bg-slate-900/50 px-2 py-1.5"
          >
            <Text className="text-xs text-slate-700 dark:text-slate-300 flex-1 pr-2">
              {hasBudgetsConfigured
                ? 'Edit monthly category budgets'
                : 'Set monthly budgets per category (all wallets)'}
            </Text>
            <MaterialIcons name="chevron-right" size={18} color="#64748b" />
          </Pressable>
        ) : null}

        {errorMessage ? (
          <Text className="text-sm text-red-600 dark:text-red-400 mb-2">{errorMessage}</Text>
        ) : null}

        {!insight?.insights?.length && !generating ? (
          <Text className="text-sm text-slate-600 dark:text-slate-400 leading-5">
            Tap Regenerate to run three specialist agents on your numbers: month-over-month trends, budget
            behavior, and where spending concentrates. Results are saved on-device.
          </Text>
        ) : null}

        {generating && !insight?.insights?.length ? (
          <View className="py-6 items-center">
            <ActivityIndicator size="large" color="#6366f1" />
            <Text className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Generating insights (3 agents)…
            </Text>
          </View>
        ) : null}

        {insight?.insights?.map((block, i) => {
          const ac = agentAccent(block.agentKey);
          return (
            <View
              key={`${block.agentKey}-${i}`}
              className={`rounded-xl border bg-white dark:bg-slate-900/85 mb-3 overflow-hidden ${ac.border}`}
            >
              <View className="flex-row items-stretch min-h-[3px]">
                <View className={`w-1 ${ac.bar}`} />
                <View className="flex-1 px-3 py-2.5">
                  <View className="flex-row items-center mb-1">
                    <MaterialIcons name={ac.icon} size={16} color="#64748b" />
                    <Text className="ml-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {block.label}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white">{block.title}</Text>
                  <Text className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-6">{block.body}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {stale && Boolean(insight?.insights?.length) && !generating ? (
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-4">
            Your numbers changed since this run. Tap Regenerate to replace these insights with ones based on
            current data.
          </Text>
        ) : null}

        {insight?.disclaimer ? (
          <Text className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 leading-4">{insight.disclaimer}</Text>
        ) : null}
      </View>
      ) : null}
    </View>
  );
}
