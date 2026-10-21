import type { CurrencyCode, MinorAmount } from '@repo/types';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { budgetNote, type BudgetNote } from '@/lib/finance/budget-note';

const heights = { tile: 4, row: 8, hero: 12 } as const;

const labelTone: Record<BudgetNote['tone'], string> = {
  plain: 'font-display-semibold text-foreground',
  quiet: 'font-display-semibold text-foreground',
  near: 'font-display-semibold text-state-attention',
  over: 'font-display-bold text-over',
};

type ProgressBarProps = {
  spentMinor: MinorAmount;
  budgetMinor: MinorAmount;
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
  const meter = budgetNote(spentMinor, budgetMinor, currency);
  const fillPct = (meter.ratio ?? 0) * 100;
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
          now: Math.round(fillPct),
        }}
        className="overflow-hidden rounded-full bg-track"
        style={{ height: heights[size] }}
      >
        <View
          className={`absolute inset-y-0 left-0 rounded-full ${meter.tone === 'over' ? 'bg-coral' : 'bg-ink-2'}`}
          style={{ width: `${fillPct}%` }}
        />
      </View>
    </View>
  );
}
