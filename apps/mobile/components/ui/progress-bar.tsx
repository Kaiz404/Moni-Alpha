import type { CurrencyCode, MinorAmount } from '@repo/types';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatWholeMoney } from '@/lib/finance/display';

export type BudgetMeter = {
  fillPct: number;
  tone: 'calm' | 'near' | 'over';
  label: string;
};

export function budgetMeter(
  spentMinor: MinorAmount | number,
  budgetMinor: MinorAmount | number,
  currency: CurrencyCode | string,
): BudgetMeter {
  const spent = Number(spentMinor);
  const budget = Number(budgetMinor);
  if (spent > budget) {
    return {
      fillPct: 100,
      tone: 'over',
      label: `${formatWholeMoney(spent - budget, currency)} over`,
    };
  }
  const fillPct = budget > 0 ? (spent / budget) * 100 : 0;
  return {
    fillPct,
    tone: fillPct >= 75 ? 'near' : 'calm',
    label: `${formatWholeMoney(budget - spent, currency)} left`,
  };
}

const heights = { tile: 4, row: 8, hero: 12 } as const;

const labelTone: Record<BudgetMeter['tone'], string> = {
  calm: 'font-display-semibold text-foreground',
  near: 'font-display-semibold text-state-attention',
  over: 'font-display-bold text-over',
};

type ProgressBarProps = {
  spentMinor: MinorAmount | number;
  budgetMinor: MinorAmount | number;
  currency: CurrencyCode | string;
  title?: string;
  size?: keyof typeof heights;
};

export function ProgressBar({
  spentMinor,
  budgetMinor,
  currency,
  title,
  size = 'row',
}: ProgressBarProps) {
  const meter = budgetMeter(spentMinor, budgetMinor, currency);
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        {title ? (
          <Text
            variant="rowTitle"
            className="min-w-0 flex-1 text-foreground"
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        <Text
          className={`text-[13px] leading-[18px] ${labelTone[meter.tone]}`}
        >
          {meter.label}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={
          title ? `${title}, ${meter.label}` : meter.label
        }
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(meter.fillPct),
        }}
        className="overflow-hidden rounded-full bg-track"
        style={{ height: heights[size] }}
      >
        <View
          className={`absolute inset-y-0 left-0 rounded-full ${meter.tone === 'over' ? 'bg-coral' : 'bg-ink-2'}`}
          style={{ width: `${meter.fillPct}%` }}
        />
      </View>
    </View>
  );
}
