import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { ReviewStatus } from '@/lib/proposals/review-status';

const TONES: Record<ReviewStatus['tone'], { fill: string; text: string; dot: string }> = {
  onTrack: { fill: 'bg-primary-muted', text: 'text-state-approved', dot: 'bg-state-approved' },
  near: { fill: 'bg-attention-fill', text: 'text-state-attention', dot: 'bg-state-attention' },
  review: { fill: 'bg-pending-fill', text: 'text-state-pending', dot: 'bg-state-pending' },
};

/** The source row's pill ("Usual for you", "Needs a wallet"): 28 tall and 12/700, as `XA-Review` draws it. */
export function SourcePill({ tone, label }: ReviewStatus) {
  const look = TONES[tone];
  return (
    <View className={`h-7 flex-row items-center gap-1.5 rounded-full px-2.5 ${look.fill}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      <Text
        className={`text-[12px] leading-[16px] font-display-bold ${look.text}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
