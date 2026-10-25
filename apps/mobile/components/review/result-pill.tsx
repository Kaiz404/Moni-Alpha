import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { BudgetLine, BudgetTone } from '@/lib/proposals/budget-line';

const TONES: Record<BudgetTone, { fill: string; text: string; dot: string }> = {
  onTrack: { fill: 'bg-primary-muted', text: 'text-state-approved', dot: 'bg-state-approved' },
  near: { fill: 'bg-attention-fill', text: 'text-state-attention', dot: 'bg-state-attention' },
  over: { fill: 'bg-destructive-fill', text: 'text-state-destructive', dot: 'bg-state-destructive' },
  review: { fill: 'bg-pending-fill', text: 'text-state-pending', dot: 'bg-state-pending' },
};

/** The source row's pill ("Needs a wallet"): 28 tall and 12/700, as `XA-Review` draws it. */
export function SourcePill({ tone, label }: { tone: BudgetTone; label: string }) {
  const look = TONES[tone];
  return (
    <View className={`h-7 flex-row items-center gap-1.5 rounded-full px-2.5 ${look.fill}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      <Text className={`text-[12px] leading-[16px] font-display-bold ${look.text}`}>{label}</Text>
    </View>
  );
}

/** The card's last line, 13/600, wrapping when the category name is long. */
export function ResultPill({ line }: { line: BudgetLine }) {
  const look = TONES[line.tone];
  return (
    <View
      className={`min-h-7 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1 ${look.fill}`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      <Text
        className={`min-w-0 shrink text-[13px] leading-[18px] font-display-semibold ${look.text}`}
      >
        {line.text}
      </Text>
    </View>
  );
}
